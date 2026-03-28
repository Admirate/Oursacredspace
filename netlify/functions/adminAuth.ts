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

    if (token) {
      const hashed = hashToken(token);
      await prisma.adminSession.deleteMany({ where: { hashedToken: hashed } });
    }

    const isProduction = process.env.NODE_ENV === "production";
    const secureSuffix = isProduction ? "; Secure" : "";
    
    return {
      statusCode: 200,
      headers,
      multiValueHeaders: {
        "Set-Cookie": [
          `admin_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureSuffix}`,
          `csrf_token=; Path=/; SameSite=Strict; Max-Age=0${secureSuffix}`,
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

      // SECURITY: Delete ALL existing sessions for this email before creating new one
      await prisma.adminSession.deleteMany({ where: { email } });
      
      const hashedToken = hashToken(token);
      
      await prisma.adminSession.create({
        data: {
          email,
          token,
          hashedToken,
          expiresAt,
          ipAddress: clientIP,
          userAgent: (event.headers["user-agent"] || "").slice(0, 500),
        },
      });

      const isProduction = process.env.NODE_ENV === "production";
      const secureSuffix = isProduction ? "; Secure" : "";
      const csrfToken = crypto.randomBytes(16).toString("hex");
      
      return {
        statusCode: 200,
        headers,
        multiValueHeaders: {
          "Set-Cookie": [
            `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${secureSuffix}`,
            `csrf_token=${csrfToken}; Path=/; SameSite=Strict; Max-Age=86400${secureSuffix}`,
          ],
        },
        body: JSON.stringify({
          success: true,
          data: { email },
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: { email: session.email },
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
