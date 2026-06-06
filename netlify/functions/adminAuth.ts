import { Handler } from "@netlify/functions";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./helpers/prisma";
import { isDbRateLimited } from "./helpers/dbRateLimit";
import { withSentry } from "./helpers/logger";
import { 
  getClientIP, 
  hashToken,
  computeCsrfToken,
  timingSafeStringEqual,
  logSecurityEvent, 
  rateLimitResponse, 
  RATE_LIMITS,
  getSecureAdminHeaders,
} from "./helpers/security";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128), // Prevent DoS via long passwords
});

// SECURITY: Use validated CORS headers to prevent CSRF attacks
const getHeaders = (event: { headers: Record<string, string | undefined> }) => {
  return getSecureAdminHeaders(event as Parameters<typeof getSecureAdminHeaders>[0]);
};

// Generate session token with high entropy
const generateToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

// Verify admin email against allowed list
const isAllowedAdmin = (email: string): boolean => {
  const allowedEmails = process.env.ADMIN_ALLOWED_EMAILS;
  if (!allowedEmails) {
    console.error("SECURITY: ADMIN_ALLOWED_EMAILS env var is not set!");
    return false;
  }
  const emailList = allowedEmails.split(",").map((e) => e.trim().toLowerCase());
  return emailList.includes(email.toLowerCase());
};

/**
 * SECURITY: Verify password against bcrypt hash stored in ADMIN_PASSWORD_HASH env var.
 * To generate a hash: node -e "require('bcryptjs').hash('yourpassword', 12).then(console.log)"
 */
const verifyPassword = async (password: string): Promise<boolean> => {
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminPasswordHash) {
    console.error("SECURITY: ADMIN_PASSWORD_HASH env var is not set!");
    return false;
  }
  return bcrypt.compare(password, adminPasswordHash);
};

const _handler: Handler = async (event) => {
  const headers = getHeaders(event);
  
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // Handle logout
  if (event.httpMethod === "DELETE") {
    const token = event.headers.cookie
      ?.split(";")
      .find((c) => c.trim().startsWith("admin_token="))
      ?.split("=")[1];

    // SECURITY (SEC-026): Verify CSRF on logout to prevent cross-site logout attacks.
    if (token) {
      const hashed = hashToken(token);
      const csrfHeader = event.headers["x-csrf-token"];
      const expectedCsrf = computeCsrfToken(hashed);

      if (!csrfHeader || !timingSafeStringEqual(csrfHeader, expectedCsrf)) {
        logSecurityEvent("AUTH_FAILURE", {
          ip: getClientIP(event),
          reason: "csrf_mismatch_logout",
        });
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ success: false, error: "CSRF validation failed" }),
        };
      }

      await prisma.adminSession.deleteMany({ where: { hashedToken: hashed } });
    }

    return {
      statusCode: 200,
      headers,
      multiValueHeaders: {
        "Set-Cookie": [
          `admin_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
        ],
      },
      body: JSON.stringify({ success: true }),
    };
  }

  // Handle login
  if (event.httpMethod === "POST") {
    // SECURITY: DB-based rate limit — works across all serverless container instances
    const clientIP = getClientIP(event);
    if (await isDbRateLimited(`login:${clientIP}`, RATE_LIMITS.LOGIN.maxRequests, RATE_LIMITS.LOGIN.windowMs)) {
      logSecurityEvent("RATE_LIMIT", { ip: clientIP, endpoint: "adminAuth" });
      return rateLimitResponse();
    }

    try {
      const body = JSON.parse(event.body || "{}");
      const { email, password } = loginSchema.parse(body);

      // Check if email is allowed
      if (!isAllowedAdmin(email)) {
        logSecurityEvent("AUTH_FAILURE", { ip: clientIP, email, reason: "email_not_allowed" });
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            error: "Invalid credentials", // Don't reveal if email exists
          }),
        };
      }

      // Verify password (bcrypt compare against ADMIN_PASSWORD_HASH)
      if (!(await verifyPassword(password))) {
        logSecurityEvent("AUTH_FAILURE", { ip: clientIP, email, reason: "invalid_password" });
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            error: "Invalid credentials",
          }),
        };
      }

      // Generate token
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // SECURITY (SEC-003): Persist ONLY the SHA-256 hash of the token. The raw
      // token is sent to the client as an HttpOnly cookie below and is never
      // stored server-side, so a DB breach cannot reveal active sessions.
      const hashedToken = hashToken(token);

      await prisma.adminSession.create({
        data: {
          email,
          hashedToken,
          expiresAt,
          ipAddress: clientIP,
          userAgent: (event.headers["user-agent"] || "").slice(0, 500),
        },
      });

      // SECURITY (SEC-017): CSRF token is HMAC-derived from the session hash,
      // returned in the response body only. No csrf_token cookie — nothing for
      // XSS to steal from document.cookie. Frontend stores it in memory.
      const csrfToken = computeCsrfToken(hashedToken);

      // SECURITY (SEC-016): Always set Secure — modern browsers allow it on localhost
      return {
        statusCode: 200,
        headers,
        multiValueHeaders: {
          "Set-Cookie": [
            `admin_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`,
          ],
        },
        body: JSON.stringify({
          success: true,
          data: { email, csrfToken },
        }),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Login error:", errorMessage);

      if (error instanceof z.ZodError) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: "Invalid email or password format",
          }),
        };
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Login failed",
        }),
      };
    }
  }

  // Handle session check (GET)
  if (event.httpMethod === "GET") {
    const token = event.headers.cookie
      ?.split(";")
      .find((c) => c.trim().startsWith("admin_token="))
      ?.split("=")[1];

    if (!token) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: "Not authenticated" }),
      };
    }

    const hashed = hashToken(token);
    const session = await prisma.adminSession.findUnique({
      where: { hashedToken: hashed },
    });

    if (!session || session.expiresAt < new Date()) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: "Session expired" }),
      };
    }

    // SECURITY (SEC-011): Verify session binding on check requests too
    const checkIP = getClientIP(event);
    const checkUA = (event.headers["user-agent"] || "").slice(0, 500);

    if (session.ipAddress && session.ipAddress !== checkIP) {
      logSecurityEvent("AUTH_FAILURE", {
        ip: checkIP,
        sessionIp: session.ipAddress,
        email: session.email,
        reason: "ip_mismatch",
      });
      await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: "Session invalidated" }),
      };
    }

    if (session.userAgent && checkUA && session.userAgent !== checkUA) {
      logSecurityEvent("AUTH_FAILURE", {
        ip: checkIP,
        email: session.email,
        reason: "user_agent_mismatch",
      });
      await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: "Session invalidated" }),
      };
    }

    // SECURITY (SEC-017): Return CSRF token on session check so the frontend
    // can restore it after page refresh without needing a cookie.
    const csrfToken = computeCsrfToken(hashed);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: { email: session.email, csrfToken },
      }),
    };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ success: false, error: "Method not allowed" }),
  };
};

export const handler = withSentry("adminAuth", _handler);
