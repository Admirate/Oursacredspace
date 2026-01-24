import { Handler } from "@netlify/functions";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "./helpers/prisma";
import { getClientIP, isRateLimited, logSecurityEvent, rateLimitResponse } from "./helpers/security";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128), // Prevent DoS via long passwords
});

const getHeaders = (event: { headers: Record<string, string | undefined> }) => {
  const origin = event.headers.origin || event.headers.Origin || "http://localhost:8888";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, Cookie",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };
};

// Generate session token
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

// Verify password (in production, use proper hashing like bcrypt)
const verifyPassword = (password: string): boolean => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("SECURITY: ADMIN_PASSWORD env var is not set!");
    return false;
  }
  // Use timing-safe comparison to prevent timing attacks
  if (password.length !== adminPassword.length) return false;
  let result = 0;
  for (let i = 0; i < password.length; i++) {
    result |= password.charCodeAt(i) ^ adminPassword.charCodeAt(i);
  }
  return result === 0;
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

    // SECURITY: Clear cookie with same flags
    const isProduction = process.env.NODE_ENV === "production";
    const cookieFlags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? "; Secure" : ""}`;
    
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
    // SECURITY: Rate limit login attempts (5 attempts per minute per IP)
    const clientIP = getClientIP(event);
    if (isRateLimited(`login:${clientIP}`, 5, 60000)) {
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

      // Delete existing session and create new
      await prisma.adminSession.upsert({
        where: { email },
        update: { token, expiresAt },
        create: { email, token, expiresAt },
      });

      // SECURITY: Set Secure flag in production for HTTPS-only cookies
      const isProduction = process.env.NODE_ENV === "production";
      const cookieFlags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${isProduction ? "; Secure" : ""}`;
      
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
