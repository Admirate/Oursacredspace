import { Handler } from "@netlify/functions";
import { z } from "zod";
import { prisma } from "./helpers/prisma";
import { BookingType, BookingStatus } from "@prisma/client";
import { getClientIP, isRateLimited, rateLimitResponse, RATE_LIMITS, getPublicHeaders } from "./helpers/security";

// Validation schema with strict limits
const createBookingSchema = z.object({
  type: z.nativeEnum(BookingType),
  name: z.string().min(2).max(100).trim(),
  phone: z
    .string()
    .transform((val) => {
      const cleaned = val.replace(/\D/g, "");
      if (cleaned.startsWith("91") && cleaned.length === 12) {
        return `+${cleaned}`;
      }
      if (cleaned.length === 10) {
        return `+91${cleaned}`;
      }
      return val;
    })
    .refine((val) => /^\+91\d{10}$/.test(val), {
      message: "Invalid phone number",
    }),
  email: z.string().email().max(254).toLowerCase(),
  classSessionId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  preferredSlots: z.array(z.string().max(100)).max(10).optional(),
  notes: z.string().max(500).trim().optional(),
  purpose: z.string().max(500).trim().optional(),
});

export const handler: Handler = async (event) => {
  // SECURITY: Use origin-validated CORS headers
  const headers = getPublicHeaders(event, "POST, OPTIONS");

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: "Method not allowed" }),
    };
  }

  // SECURITY: Rate limit booking creation
  const clientIP = getClientIP(event);
  if (isRateLimited(`booking:${clientIP}`, RATE_LIMITS.BOOKING_CREATE.maxRequests, RATE_LIMITS.BOOKING_CREATE.windowMs)) {
    return rateLimitResponse();
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const validatedData = createBookingSchema.parse(body);

    let amountPaise = 0;
    let spaceRequestId: string | undefined;

    // === Handle CLASS booking ===
    if (validatedData.type === BookingType.CLASS) {
      if (!validatedData.classSessionId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: "classSessionId is required for CLASS booking",
          }),
        };
      }

      const classSession = await prisma.classSession.findUnique({
        where: { id: validatedData.classSessionId },
      });

      if (!classSession) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: "Class session not found",
          }),
        };
      }

      if (!classSession.active) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: "This class is no longer available",
          }),
        };
      }

      const spotsLeft = classSession.capacity - classSession.spotsBooked;
      if (spotsLeft <= 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: "This class is fully booked",
          }),
        };
      }

      amountPaise = classSession.pricePaise;
    }

    // === Handle EVENT booking ===
    if (validatedData.type === BookingType.EVENT) {
      if (!validatedData.eventId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: "eventId is required for EVENT booking",
          }),
        };
      }

      const event = await prisma.event.findUnique({
        where: { id: validatedData.eventId },
      });

      if (!event) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: "Event not found",
          }),
        };
      }

      if (!event.active) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: "This event is no longer available",
          }),
        };
      }

      amountPaise = event.pricePaise;
    }

    // === Handle SPACE booking ===
    if (validatedData.type === BookingType.SPACE) {
      if (!validatedData.preferredSlots || validatedData.preferredSlots.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: "preferredSlots is required for SPACE booking",
          }),
        };
      }

      // Create SpaceRequest first
      const spaceRequest = await prisma.spaceRequest.create({
        data: {
          name: validatedData.name,
          phone: validatedData.phone,
          email: validatedData.email,
          preferredSlots: validatedData.preferredSlots,
          notes: validatedData.notes,
          purpose: validatedData.purpose,
          status: "REQUESTED",
        },
      });

      spaceRequestId = spaceRequest.id;
      amountPaise = 0; // No payment for space request initially
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        type: validatedData.type,
        status:
          validatedData.type === BookingType.SPACE
            ? BookingStatus.CONFIRMED // Space requests don't need payment initially
            : BookingStatus.PENDING_PAYMENT,
        name: validatedData.name,
        phone: validatedData.phone,
        email: validatedData.email,
        amountPaise,
        currency: "INR",
        classSessionId: validatedData.classSessionId,
        eventId: validatedData.eventId,
        spaceRequestId,
      },
    });

    // Create status history
    await prisma.statusHistory.create({
      data: {
        bookingId: booking.id,
        fromStatus: "NONE",
        toStatus: booking.status,
        changedBy: "SYSTEM",
        reason: "Booking created",
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          bookingId: booking.id,
          type: booking.type,
          amount: amountPaise,
          requiresPayment: validatedData.type !== BookingType.SPACE && amountPaise > 0,
        },
      }),
    };
  } catch (error) {
    // Safely log the error
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // Log full error server-side only
    console.error("Create booking error:", errorMessage);

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: error.errors[0]?.message || "Validation error",
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage || "Failed to create booking. Please try again.",
      }),
    };
  }
};
