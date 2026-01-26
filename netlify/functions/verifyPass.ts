import { Handler } from "@netlify/functions";
import { prisma } from "./helpers/prisma";
import { getClientIP, isRateLimited, rateLimitResponse, RATE_LIMITS, getPublicHeaders } from "./helpers/security";

// SECURITY: Validate pass ID format (OSS-EV-XXXXXXXX where X is alphanumeric)
const PASS_ID_REGEX = /^OSS-EV-[A-Z0-9]{8}$/;

export const handler: Handler = async (event) => {
  // SECURITY: Use origin-validated CORS headers
  const headers = getPublicHeaders(event, "GET, OPTIONS");

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: "Method not allowed" }),
    };
  }

  // SECURITY: Rate limit to prevent pass ID enumeration attacks
  const clientIP = getClientIP(event);
  if (isRateLimited(`verifyPass:${clientIP}`, RATE_LIMITS.PASS_VERIFY.maxRequests, RATE_LIMITS.PASS_VERIFY.windowMs)) {
    return rateLimitResponse();
  }

  try {
    const passId = event.queryStringParameters?.passId;

    if (!passId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: "passId is required" }),
      };
    }

    // SECURITY: Validate pass ID format to prevent injection
    if (!PASS_ID_REGEX.test(passId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: "Invalid passId format" }),
      };
    }

    const eventPass = await prisma.eventPass.findUnique({
      where: { passId },
      include: {
        event: true,
        booking: {
          select: {
            name: true,
            phone: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!eventPass) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: true,
          data: { valid: false },
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          valid: true,
          pass: {
            id: eventPass.id,
            passId: eventPass.passId,
            checkInStatus: eventPass.checkInStatus,
            checkInTime: eventPass.checkInTime,
          },
          event: eventPass.event,
          attendeeName: eventPass.booking.name,
          bookingStatus: eventPass.booking.status,
        },
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Verify pass error:", errorMessage);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to verify pass",
      }),
    };
  }
};
