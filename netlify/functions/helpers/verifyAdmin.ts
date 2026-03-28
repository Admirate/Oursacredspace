import { HandlerEvent } from "@netlify/functions";
import { prisma } from "./prisma";
import { getSecureAdminHeaders, hashToken, logSecurityEvent } from "./security";

export interface AdminVerifyResult {
  isValid: boolean;
  email?: string;
  error?: string;
}

/**
 * SECURITY: Parse admin token from cookie safely
 * Validates token format to prevent injection attacks
 */
const parseAdminToken = (cookieHeader: string | undefined): string | null => {
  if (!cookieHeader) return null;
  
  const tokenMatch = cookieHeader
    .split(";")
    .find((c) => c.trim().startsWith("admin_token="));
  
  if (!tokenMatch) return null;
  
  const token = tokenMatch.split("=")[1]?.trim();
  
  // SECURITY: Validate token format (should be 64 hex characters)
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return null;
  }
  
  return token;
};

export const verifyAdminSession = async (
  event: HandlerEvent
): Promise<AdminVerifyResult> => {
  try {
    const method = event.httpMethod.toUpperCase();

    // SECURITY: CSRF double-submit cookie check for all state-changing requests
    if (method !== "GET" && method !== "OPTIONS") {
      const csrfHeader = event.headers["x-csrf-token"];
      const csrfCookie = event.headers.cookie
        ?.split(";")
        .find((c) => c.trim().startsWith("csrf_token="))
        ?.split("=")[1]
        ?.trim();

      if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
        logSecurityEvent("AUTH_FAILURE", {
          ip: event.headers["x-forwarded-for"] || "unknown",
          reason: "csrf_mismatch",
        });
        return { isValid: false, error: "CSRF validation failed" };
      }
    }

    const token = parseAdminToken(event.headers.cookie);

    if (!token) {
      return { isValid: false, error: "Not authenticated" };
    }

    const hashedTokenValue = hashToken(token);
    const session = await prisma.adminSession.findUnique({
      where: { hashedToken: hashedTokenValue },
    });

    if (!session) {
      return { isValid: false, error: "Invalid session" };
    }

    if (session.expiresAt < new Date()) {
      await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
      return { isValid: false, error: "Session expired" };
    }

    return { isValid: true, email: session.email };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Admin verify error:", errorMessage);
    return { isValid: false, error: "Authentication failed" };
  }
};

/**
 * SECURITY: Get CORS headers with validated origin
 * This prevents CSRF attacks by only allowing whitelisted origins
 */
export const getAdminHeaders = (event: HandlerEvent) => {
  return getSecureAdminHeaders(event);
};

// Helper to create unauthorized response
export const unauthorizedResponse = (event: HandlerEvent, error: string = "Unauthorized") => ({
  statusCode: 401,
  headers: getAdminHeaders(event),
  body: JSON.stringify({ success: false, error }),
});
