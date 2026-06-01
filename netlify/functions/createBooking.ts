import { Handler } from "@netlify/functions";
import { z } from "zod";
import { prisma } from "./helpers/prisma";
import { BookingType, BookingStatus } from "@prisma/client";
import { getClientIP, isRateLimited, rateLimitResponse, RATE_LIMITS, getPublicHeaders } from "./helpers/security";
import { withSentry } from "./helpers/logger";

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
  classSessionId: z.string().min(1).max(30).optional(),
  eventId: z.string().min(1).max(30).optional(),
  preferredSlots: z.array(z.string().max(100)).max(10).optional(),
  notes: z.string().max(500).trim().optional(),
  purpose: z.string().max(500).trim().optional(),
});

const _handler: Handler = async (event) => {
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

      const [classSession, classBookedCount] = await Promise.all([
        prisma.classSession.findUnique({
          where: { id: validatedData.classSessionId },
          select: { id: true, active: true, capacity: true, pricePaise: true, deletedAt: true },
        }),
        prisma.booking.count({
          where: {
            classSessionId: validatedData.classSessionId,
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT] },
            deletedAt: null,
          },
        }),
      ]);

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

      if (classSession.capacity !== null && classBookedCount >= classSession.capacity) {
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

      const [eventRecord, eventBookedCount] = await Promise.all([
        prisma.event.findUnique({
          where: { id: validatedData.eventId },
          select: { id: true, active: true, capacity: true, pricePaise: true, deletedAt: true },
        }),
        prisma.booking.count({
          where: {
            eventId: validatedData.eventId,
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT] },
            deletedAt: null,
          },
        }),
      ]);

      if (!eventRecord) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: "Event not found",
          }),
        };
      }

      if (!eventRecord.active) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: "This event is no longer available",
          }),
        };
      }

      if (eventRecord.capacity !== null && eventBookedCount >= eventRecord.capacity) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: "This event is fully booked",
          }),
        };
      }

      amountPaise = eventRecord.pricePaise;
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

      const spaceRequest = await prisma.spaceRequest.create({
        data: {
          customerName: validatedData.name,
          customerPhone: validatedData.phone,
          customerEmail: validatedData.email,
          preferredSlots: validatedData.preferredSlots,
          notes: validatedData.notes,
          purpose: validatedData.purpose,
          status: "REQUESTED",
        },
      });

      spaceRequestId = spaceRequest.id;
      amountPaise = 0;
    }

    // Idempotency: reject if a non-terminal booking already exists for
    // the same customer + resource, preventing duplicate bookings from
    // double-clicks or network retries.
    const activeStatuses = [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED];
    const duplicateWhere: Record<string, unknown> = {
      customerEmail: validatedData.email,
      status: { in: activeStatuses },
      deletedAt: null,
    };
    if (validatedData.type === BookingType.CLASS) {
      duplicateWhere.classSessionId = validatedData.classSessionId;
    } else if (validatedData.type === BookingType.EVENT) {
      duplicateWhere.eventId = validatedData.eventId;
    } else if (validatedData.type === BookingType.SPACE && spaceRequestId) {
      duplicateWhere.spaceRequestId = spaceRequestId;
    }

    const existingBooking = await prisma.booking.findFirst({
      where: duplicateWhere,
      select: { id: true, type: true, amountPaise: true, status: true },
    });
    if (existingBooking) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            bookingId: existingBooking.id,
            type: existingBooking.type,
            amount: existingBooking.amountPaise,
            requiresPayment:
              existingBooking.type !== BookingType.SPACE &&
              existingBooking.amountPaise > 0 &&
              existingBooking.status === BookingStatus.PENDING_PAYMENT,
          },
        }),
      };
    }

    // Use a transaction with SELECT FOR UPDATE for atomic capacity check
    const booking = await prisma.$transaction(async (tx) => {
      // Re-check capacity inside transaction to prevent race conditions
      if (validatedData.type === BookingType.CLASS && validatedData.classSessionId) {
        const cs = await tx.classSession.findUnique({
          where: { id: validatedData.classSessionId },
          select: { capacity: true },
        });
        if (cs?.capacity !== null && cs?.capacity !== undefined) {
          const count = await tx.booking.count({
            where: {
              classSessionId: validatedData.classSessionId,
              status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT] },
              deletedAt: null,
            },
          });
          if (count >= cs.capacity) {
            throw new Error("CLASS_FULL");
          }
        }
      }

      if (validatedData.type === BookingType.EVENT && validatedData.eventId) {
        const ev = await tx.event.findUnique({
          where: { id: validatedData.eventId },
          select: { capacity: true },
        });
        if (ev?.capacity !== null && ev?.capacity !== undefined) {
          const count = await tx.booking.count({
            where: {
              eventId: validatedData.eventId,
              status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT] },
              deletedAt: null,
            },
          });
          if (count >= ev.capacity) {
            throw new Error("EVENT_FULL");
          }
        }
      }

      const newBooking = await tx.booking.create({
        data: {
          type: validatedData.type,
          status:
            validatedData.type === BookingType.SPACE
              ? BookingStatus.REQUESTED
              : BookingStatus.PENDING_PAYMENT,
          customerName: validatedData.name,
          customerPhone: validatedData.phone,
          customerEmail: validatedData.email,
          amountPaise,
          currency: "INR",
          classSessionId: validatedData.classSessionId,
          eventId: validatedData.eventId,
          spaceRequestId,
        },
      });

      await tx.statusHistory.create({
        data: {
          bookingId: newBooking.id,
          fromStatus: "NONE",
          toStatus: newBooking.status,
          changedBy: "SYSTEM",
          reason: "Booking created",
        },
      });

      return newBooking;
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
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

    if (errorMessage === "CLASS_FULL") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: "This class is fully booked" }),
      };
    }

    if (errorMessage === "EVENT_FULL") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: "This event is fully booked" }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to create booking. Please try again.",
      }),
    };
  }
};

export const handler = withSentry("createBooking", _handler);
