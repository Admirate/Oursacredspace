import { Handler } from "@netlify/functions";
import { prisma } from "./helpers/prisma";
import {
  getClientIP,
  isRateLimited,
  rateLimitResponse,
  RATE_LIMITS,
  getPublicHeaders,
  hashToken,
} from "./helpers/security";
import { withSentry } from "./helpers/logger";

// SECURITY: ID format validation (supports CUID and UUID)
const ID_REGEX = /^[a-z0-9]{20,30}$|^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// SECURITY (SEC-005): Access token format check. base64url-encoded 32 bytes
// produces 43 chars from [A-Za-z0-9_-]. Reject obviously malformed inputs
// before any DB work to keep the unauthenticated surface small.
const ACCESS_TOKEN_REGEX = /^[A-Za-z0-9_-]{40,64}$/;

const NOT_FOUND_BODY = JSON.stringify({
  success: false,
  error: "Booking not found",
});

const _handler: Handler = async (event) => {
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

  // SECURITY: Rate limit to prevent booking ID enumeration
  const clientIP = getClientIP(event);
  if (isRateLimited(`getBooking:${clientIP}`, RATE_LIMITS.BOOKING_READ.maxRequests, RATE_LIMITS.BOOKING_READ.windowMs)) {
    return rateLimitResponse();
  }

  try {
    const bookingId = event.queryStringParameters?.bookingId;
    // SECURITY (SEC-005): Access token is REQUIRED. Without it, this endpoint
    // returns 404 even for valid booking IDs so that booking ID enumeration
    // cannot reveal customer PII (customerName / email / phone) or expose
    // whether a given booking ID exists.
    const accessToken =
      event.queryStringParameters?.token ?? event.queryStringParameters?.accessToken;

    if (!bookingId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: "bookingId is required" }),
      };
    }

    // SECURITY: Validate ID format to prevent injection
    if (!ID_REGEX.test(bookingId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: "Invalid bookingId format" }),
      };
    }

    // SECURITY: Reject requests without a well-formed token with the same
    // generic 404 used for token mismatches, so callers cannot distinguish
    // "missing token" from "wrong token" or "wrong booking".
    if (!accessToken || !ACCESS_TOKEN_REGEX.test(accessToken)) {
      return { statusCode: 404, headers, body: NOT_FOUND_BODY };
    }

    const accessTokenHash = hashToken(accessToken);

    // SECURITY: Match BOTH id and accessTokenHash. findFirst is used because
    // we need a compound match; both fields must agree before any row is
    // returned. Wrong booking ID, wrong token, or a legacy row without a
    // hash all collapse into the same 404 response.
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, accessTokenHash },
      select: {
        id: true,
        type: true,
        status: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        amountPaise: true,
        currency: true,
        quantity: true,
        createdAt: true,
        // Drives the countdown + Pay-button state on /success, so the UI can
        // stop offering payment the moment the seat hold lapses.
        holdExpiresAt: true,
        classSession: {
          select: { title: true, startsAt: true, duration: true, location: true },
        },
        event: {
          select: { title: true, startsAt: true, venue: true, endsAt: true },
        },
        spaceRequest: {
          select: { purpose: true, status: true, scheduledSlot: true },
        },
      },
    });

    if (!booking) {
      return { statusCode: 404, headers, body: NOT_FOUND_BODY };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: booking,
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Get booking error:", errorMessage);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch booking. Please try again.",
      }),
    };
  }
};

export const handler = withSentry("getBooking", _handler);
