import { Handler } from "@netlify/functions";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "./helpers/prisma";
import { 
  getClientIP, 
  isRateLimited, 
  logSecurityEvent, 
  rateLimitResponse, 
  RATE_LIMITS,
  getSecureAdminHeaders,
  timingSafeCompare
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
 * SECURITY: Verify password using timing-safe comparison
 * 
 * For production with multiple admins, consider using bcrypt:
 * 1. Store hashed password in env: ADMIN_PASSWORD_HASH
 * 2. Use: await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH)
 * 
 * Current implementation uses timing-safe comparison to prevent timing attacks.
 */
const verifyPassword = (password: string): boolean => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("SECURITY: ADMIN_PASSWORD env var is not set!");
    return false;
  }
  
  // SECURITY: Use timing-safe comparison to prevent timing attacks
  // This takes constant time regardless of where strings differ
  return timingSafeCompare(password, adminPassword);
};

export const handler: Handler = async (event) => {
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
      await prisma.adminSession.deleteMany({ where: { token } });
    }

    // SECURITY: Clear cookie with same flags (SameSite=Strict for CSRF protection)
    const isProduction = process.env.NODE_ENV === "production";
    const cookieFlags = `Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProduction ? "; Secure" : ""}`;
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Set-Cookie": `admin_token=; ${cookieFlags}`,
      },
      body: JSON.stringify({ success: true }),
    };
  }

  // Handle login
  if (event.httpMethod === "POST") {
    // SECURITY: Rate limit login attempts to prevent brute force
    const clientIP = getClientIP(event);
    if (isRateLimited(`login:${clientIP}`, RATE_LIMITS.LOGIN.maxRequests, RATE_LIMITS.LOGIN.windowMs)) {
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

      // Verify password
      if (!verifyPassword(password)) {
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
      // This prevents session accumulation and ensures clean token rotation
      await prisma.adminSession.deleteMany({ where: { email } });
      
      // Create new session
      await prisma.adminSession.create({
        data: { email, token, expiresAt },
      });

      // SECURITY: Set Secure flag in production, SameSite=Strict for CSRF protection
      const isProduction = process.env.NODE_ENV === "production";
      const cookieFlags = `Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${isProduction ? "; Secure" : ""}`;
      
      return {
        statusCode: 200,
        headers: {
          ...headers,
          "Set-Cookie": `admin_token=${token}; ${cookieFlags}`,
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

    const session = await prisma.adminSession.findUnique({
      where: { token },
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
