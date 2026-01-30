/**
 * Security Helpers for Netlify Functions
 * Implements security best practices
 */

import { HandlerEvent } from "@netlify/functions";
import crypto from "crypto";

/**
 * Rate limiting store
 * 
 * IMPORTANT: In serverless environments, each function invocation may run in
 * a different container, so in-memory rate limiting is not 100% reliable.
 * 
 * For production, consider using:
 * - Upstash Redis (serverless-friendly): https://upstash.com/
 * - Netlify's built-in rate limiting (if available)
 * - A CDN-level rate limiter (Cloudflare, etc.)
 * 
 * The current implementation still provides protection against:
 * - Bursts from a single container
 * - Casual abuse attempts
 * - Development/testing scenarios
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up old entries periodically to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastCleanup = Date.now();

const cleanupExpiredEntries = () => {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
};

/**
 * SECURITY: Timing-safe string comparison to prevent timing attacks
 * Always takes the same amount of time regardless of where strings differ
 */
export const timingSafeCompare = (a: string, b: string): boolean => {
  // Pad both strings to same length to prevent length-based timing attacks
  const maxLength = Math.max(a.length, b.length);
  const paddedA = a.padEnd(maxLength, '\0');
  const paddedB = b.padEnd(maxLength, '\0');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(paddedA, 'utf8'),
      Buffer.from(paddedB, 'utf8')
    );
  } catch {
    return false;
  }
};

/**
 * SECURITY: Generate cryptographically secure random string
 * Use this instead of Math.random() for security-sensitive operations
 */
export const generateSecureId = (
  length: number = 8,
  charset: string = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
): string => {
  const randomBytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset.charAt(randomBytes[i] % charset.length);
  }
  return result;
};

/**
 * SECURITY: Sanitize string for use in WhatsApp/notification templates
 * Removes potential injection characters
 */
export const sanitizeTemplateParam = (value: string, maxLength: number = 100): string => {
  return value
    .replace(/[\n\r\t]/g, ' ')      // Replace newlines/tabs with spaces
    .replace(/[<>{}[\]\\]/g, '')    // Remove potential injection chars
    .replace(/\s+/g, ' ')           // Collapse multiple spaces
    .trim()
    .slice(0, maxLength);
};

/**
 * SECURITY: Validate file magic bytes to prevent MIME type spoofing
 */
export const validateImageMagicBytes = (buffer: Buffer): { valid: boolean; mimeType: string | null } => {
  if (buffer.length < 4) {
    return { valid: false, mimeType: null };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, mimeType: 'image/jpeg' };
  }
  
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { valid: true, mimeType: 'image/png' };
  }
  
  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return { valid: true, mimeType: 'image/gif' };
  }
  
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer.length > 11 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return { valid: true, mimeType: 'image/webp' };
  }

  return { valid: false, mimeType: null };
};

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
 * Predefined rate limit configurations for different endpoint types
 */
export const RATE_LIMITS = {
  // Critical - auth and payment
  LOGIN: { maxRequests: 5, windowMs: 60000 },           // 5 per minute
  PAYMENT: { maxRequests: 5, windowMs: 60000 },         // 5 per minute
  
  // Booking operations
  BOOKING_CREATE: { maxRequests: 10, windowMs: 60000 }, // 10 per minute
  BOOKING_READ: { maxRequests: 60, windowMs: 60000 },   // 60 per minute
  
  // Public read endpoints
  PUBLIC_READ: { maxRequests: 100, windowMs: 60000 },   // 100 per minute
  
  // Pass verification (prevent enumeration)
  PASS_VERIFY: { maxRequests: 30, windowMs: 60000 },    // 30 per minute
  
  // Admin operations (already protected by auth)
  ADMIN_READ: { maxRequests: 200, windowMs: 60000 },    // 200 per minute
  ADMIN_WRITE: { maxRequests: 50, windowMs: 60000 },    // 50 per minute
} as const;

/**
 * Simple rate limiter
 * @param identifier - IP or user ID (e.g., "booking:192.168.1.1")
 * @param maxRequests - Max requests per window
 * @param windowMs - Time window in milliseconds
 */
export const isRateLimited = (
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
): boolean => {
  // Periodically clean up expired entries
  cleanupExpiredEntries();
  
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
 * Get list of allowed origins from environment
 */
const getAllowedOrigins = (): string[] => {
  return [
    "http://localhost:3000",
    "http://localhost:8888",
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter((origin): origin is string => Boolean(origin));
};

/**
 * Check if request is from allowed origin
 */
export const isAllowedOrigin = (event: HandlerEvent): boolean => {
  const origin = event.headers.origin || event.headers.Origin;
  if (!origin) return true; // Same-origin requests don't have origin header
  return getAllowedOrigins().includes(origin);
};

/**
 * Get validated origin for CORS header
 * Returns the origin if allowed, otherwise returns the first allowed origin
 * SECURITY: This prevents CORS bypass attacks by validating against allowlist
 */
export const getValidatedOrigin = (event: HandlerEvent): string => {
  const origin = event.headers.origin || event.headers.Origin;
  const allowedOrigins = getAllowedOrigins();
  
  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }
  // Return first allowed origin as fallback (for same-origin requests or blocked origins)
  return allowedOrigins[0] || "http://localhost:3000";
};

/**
 * SECURITY: Get CORS headers for admin endpoints (with strict origin validation)
 * Use this for all admin endpoints to prevent CSRF attacks
 */
export const getSecureAdminHeaders = (event: HandlerEvent) => ({
  "Access-Control-Allow-Origin": getValidatedOrigin(event),
  "Access-Control-Allow-Headers": "Content-Type, Cookie",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

/**
 * Get CORS headers for public endpoints (restricted to allowed origins)
 * Use this for endpoints that handle user data or sensitive operations
 */
export const getPublicHeaders = (event: HandlerEvent, methods: string = "GET, POST, OPTIONS") => ({
  "Access-Control-Allow-Origin": getValidatedOrigin(event),
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": methods,
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
});

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
