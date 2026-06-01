import { Handler } from "@netlify/functions";
import { prisma } from "./helpers/prisma";
import { getClientIP, isRateLimited, rateLimitResponse, RATE_LIMITS, getPublicHeaders } from "./helpers/security";
import { withSentry } from "./helpers/logger";

// SECURITY: ID format validation (supports CUID and UUID)
const ID_REGEX = /^[a-z0-9]{20,30}$|^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        type: true,
        status: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        amountPaise: true,
        currency: true,
        createdAt: true,
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
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: "Booking not found" }),
      };
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
