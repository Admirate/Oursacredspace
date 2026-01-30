import { HandlerEvent } from "@netlify/functions";
import { prisma } from "./prisma";
import { getSecureAdminHeaders } from "./security";

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
    const token = parseAdminToken(event.headers.cookie);

    if (!token) {
      return { isValid: false, error: "Not authenticated" };
    }

    const session = await prisma.adminSession.findUnique({
      where: { token },
    });

    if (!session) {
      return { isValid: false, error: "Invalid session" };
    }

    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await prisma.adminSession.delete({ where: { token } }).catch(() => {
        // Ignore errors during cleanup
      });
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
