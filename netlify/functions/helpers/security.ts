/**
 * Security Helpers for Netlify Functions
 * Implements security best practices
 */

import { HandlerEvent } from "@netlify/functions";

// Rate limiting store (in-memory for serverless - consider Redis for production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Get client IP from request
 */
export const getClientIP = (event: HandlerEvent): string => {
  return (
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    event.headers["x-real-ip"] ||
    event.headers["client-ip"] ||
    "unknown"
  );
};

/**
 * Simple rate limiter
 * @param identifier - IP or user ID
 * @param maxRequests - Max requests per window
 * @param windowMs - Time window in milliseconds
 */
export const isRateLimited = (
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
): boolean => {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return false;
  }

  record.count++;
  if (record.count > maxRequests) {
    return true;
  }

  return false;
};

/**
 * Sanitize string input to prevent XSS
 */
export const sanitizeString = (input: string): string => {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
};

/**
 * Validate that required env vars are set
 */
export const validateEnvVars = (required: string[]): { valid: boolean; missing: string[] } => {
  const missing = required.filter((key) => !process.env[key]);
  return {
    valid: missing.length === 0,
    missing,
  };
};

/**
 * Get secure response headers
 */
export const getSecureHeaders = (origin?: string) => ({
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  ...(origin && {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Cookie",
  }),
});

/**
 * Check if request is from allowed origin
 */
export const isAllowedOrigin = (event: HandlerEvent): boolean => {
  const origin = event.headers.origin || event.headers.Origin;
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:8888",
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean);

  if (!origin) return true; // Same-origin requests don't have origin header
  return allowedOrigins.includes(origin);
};

/**
 * Create rate limit exceeded response
 */
export const rateLimitResponse = () => ({
  statusCode: 429,
  headers: {
    "Content-Type": "application/json",
    "Retry-After": "60",
  },
  body: JSON.stringify({
    success: false,
    error: "Too many requests. Please try again later.",
  }),
});

/**
 * Log security event (for monitoring)
 */
export const logSecurityEvent = (
  type: "AUTH_FAILURE" | "RATE_LIMIT" | "INVALID_SIGNATURE" | "SUSPICIOUS_REQUEST",
  details: Record<string, unknown>
): void => {
  // In production, send to logging service (e.g., DataDog, Sentry)
  console.warn(`[SECURITY] ${type}:`, JSON.stringify(details));
};
