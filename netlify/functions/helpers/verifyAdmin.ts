import { HandlerEvent } from "@netlify/functions";
import { prisma } from "./prisma";

export interface AdminVerifyResult {
  isValid: boolean;
  email?: string;
  error?: string;
}

export const verifyAdminSession = async (
  event: HandlerEvent
): Promise<AdminVerifyResult> => {
  try {
    const token = event.headers.cookie
      ?.split(";")
      .find((c) => c.trim().startsWith("admin_token="))
      ?.split("=")[1];

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
      await prisma.adminSession.delete({ where: { token } });
      return { isValid: false, error: "Session expired" };
    }

    return { isValid: true, email: session.email };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Admin verify error:", errorMessage);
    return { isValid: false, error: "Authentication failed" };
  }
};

// Helper to get CORS headers with dynamic origin
export const getAdminHeaders = (event: HandlerEvent) => {
  const origin = event.headers.origin || event.headers.Origin || "http://localhost:8888";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, Cookie",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };
};

// Helper to create unauthorized response
export const unauthorizedResponse = (event: HandlerEvent, error: string = "Unauthorized") => ({
  statusCode: 401,
  headers: getAdminHeaders(event),
  body: JSON.stringify({ success: false, error }),
});
