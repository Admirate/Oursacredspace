import { HandlerEvent } from "@netlify/functions";
import { prisma } from "./prisma";
import { getSecureAdminHeaders, getClientIP, hashToken, computeCsrfToken, timingSafeStringEqual, logSecurityEvent } from "./security";

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

    const hashedTokenValue = hashToken(token);
    const session = await prisma.adminSession.findUnique({
      where: { hashedToken: hashedTokenValue },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
      },
    });

    if (!session) {
      return { isValid: false, error: "Invalid session" };
    }

    // SECURITY (SEC-017): CSRF check using HMAC-derived token. The expected
    // value is computed from the session hash — no cookie needed. The frontend
    // receives the token at login/session-check and sends it as a header.
    const method = event.httpMethod.toUpperCase();
    if (method !== "GET" && method !== "OPTIONS") {
      const csrfHeader = event.headers["x-csrf-token"];
      const expectedCsrf = computeCsrfToken(hashedTokenValue);

      if (!csrfHeader || !timingSafeStringEqual(csrfHeader, expectedCsrf)) {
        logSecurityEvent("AUTH_FAILURE", {
          ip: event.headers["x-forwarded-for"] || "unknown",
          email: session.email,
          reason: "csrf_mismatch",
        });
        return { isValid: false, error: "CSRF validation failed" };
      }
    }

    if (session.expiresAt < new Date()) {
      await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
      return { isValid: false, error: "Session expired" };
    }

    // SECURITY (SEC-011): Bind session to the originating IP and user-agent.
    // A stolen token used from a different device/network is rejected.
    const currentIP = getClientIP(event);
    const currentUA = (event.headers["user-agent"] || "").slice(0, 500);

    if (session.ipAddress && session.ipAddress !== currentIP) {
      logSecurityEvent("AUTH_FAILURE", {
        ip: currentIP,
        sessionIp: session.ipAddress,
        email: session.email,
        reason: "ip_mismatch",
      });
      await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
      return { isValid: false, error: "Session invalidated — IP address changed" };
    }

    if (session.userAgent && currentUA && session.userAgent !== currentUA) {
      logSecurityEvent("AUTH_FAILURE", {
        ip: currentIP,
        email: session.email,
        reason: "user_agent_mismatch",
      });
      await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
      return { isValid: false, error: "Session invalidated — device mismatch" };
    }

    // Update last activity timestamp (fire-and-forget)
    prisma.adminSession
      .update({ where: { id: session.id }, data: { lastActivityAt: new Date() } })
      .catch(() => {});

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
