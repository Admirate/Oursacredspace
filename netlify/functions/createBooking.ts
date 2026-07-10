import { Handler } from "@netlify/functions";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "./helpers/prisma";
import { BookingType, BookingStatus } from "@prisma/client";
import {
  getClientIP,
  rateLimitResponse,
  RATE_LIMITS,
  getPublicHeaders,
  hashToken,
} from "./helpers/security";
import { isDbRateLimited } from "./helpers/dbRateLimit";
import { withSentry } from "./helpers/logger";
import { sendResumePaymentLink, sendSpaceRequestNotification } from "./helpers/notifications";
import {
  occupiesSeatWhere,
  expireStaleHolds,
  holdHasExpired,
  lockResourceForBooking,
  newHoldExpiry,
  refreshHoldForResume,
} from "./helpers/bookingHold";

/**
 * SECURITY (SEC-005, SEC-006): Per-booking access token.
 * 32 random bytes encoded as base64url -> 43 URL-safe characters of
 * cryptographic entropy. The raw token is returned to the client exactly
 * once at creation time; only its SHA-256 hash is persisted.
 */
const generateBookingAccessToken = (): string =>
  crypto.randomBytes(32).toString("base64url");

// Validation schema with strict limits
const createBookingSchema = z.object({
  type: z.nativeEnum(BookingType),
  name: z.string().min(2).max(100).trim()
    .regex(/^[\p{L}\p{M}'\-.\s]+$/u, "Name contains invalid characters")
    // Collapse internal runs of whitespace so "Megha  Dash" and "Megha Dash"
    // are the same attendee. The duplicate check compares on this value, so
    // normalising here keeps stored and compared names consistent.
    .transform((val) => val.replace(/\s+/g, " ")),
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
  // Multi-seat: default 1, hard cap of 10 seats per booking to bound abuse.
  // Actual availability is enforced against remaining capacity below.
  quantity: z.number().int().min(1).max(10).optional().default(1),
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
  if (await isDbRateLimited(`booking:${clientIP}`, RATE_LIMITS.BOOKING_CREATE.maxRequests, RATE_LIMITS.BOOKING_CREATE.windowMs)) {
    return rateLimitResponse();
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const validatedData = createBookingSchema.parse(body);

    let amountPaise = 0;

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

      // Release seats held by abandoned checkouts before counting. Best-effort:
      // occupiesSeatWhere() below already excludes them from the count, so a
      // failure here cannot cause an overbooking.
      await expireStaleHolds({ classSessionId: validatedData.classSessionId });

      const [classSession, classBooked] = await Promise.all([
        prisma.classSession.findUnique({
          where: { id: validatedData.classSessionId },
          select: { id: true, active: true, capacity: true, pricePaise: true, deletedAt: true },
        }),
        // Sum of seats already reserved (multi-seat aware), not a row count.
        prisma.booking.aggregate({
          _sum: { quantity: true },
          where: {
            classSessionId: validatedData.classSessionId,
            ...occupiesSeatWhere(),
          },
        }),
      ]);
      const classBookedSeats = classBooked._sum.quantity ?? 0;

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

      if (
        classSession.capacity !== null &&
        classBookedSeats + validatedData.quantity > classSession.capacity
      ) {
        const remaining = Math.max(0, classSession.capacity - classBookedSeats);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error:
              remaining === 0
                ? "This class is fully booked"
                : `Only ${remaining} spot${remaining === 1 ? "" : "s"} left for this class`,
          }),
        };
      }

      amountPaise = classSession.pricePaise * validatedData.quantity;
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

      // See the CLASS branch: release abandoned holds before counting.
      await expireStaleHolds({ eventId: validatedData.eventId });

      const [eventRecord, eventBooked] = await Promise.all([
        prisma.event.findUnique({
          where: { id: validatedData.eventId },
          select: { id: true, active: true, capacity: true, pricePaise: true, deletedAt: true },
        }),
        // Sum of seats already reserved (multi-seat aware), not a row count.
        prisma.booking.aggregate({
          _sum: { quantity: true },
          where: {
            eventId: validatedData.eventId,
            ...occupiesSeatWhere(),
          },
        }),
      ]);
      const eventBookedSeats = eventBooked._sum.quantity ?? 0;

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

      if (
        eventRecord.capacity !== null &&
        eventBookedSeats + validatedData.quantity > eventRecord.capacity
      ) {
        const remaining = Math.max(0, eventRecord.capacity - eventBookedSeats);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error:
              remaining === 0
                ? "This event is fully booked"
                : `Only ${remaining} pass${remaining === 1 ? "" : "es"} left for this event`,
          }),
        };
      }

      amountPaise = eventRecord.pricePaise * validatedData.quantity;
    }

    // === Handle SPACE booking ===
    // NOTE (F6): We deliberately do NOT create the SpaceRequest row here. It is
    // created inside the transaction below, atomically with the Booking, so a
    // duplicate 409 or a transaction failure can never leave an orphaned
    // SpaceRequest with no owning Booking.
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

      amountPaise = 0;
    }

    // SECURITY (SEC-004): Idempotency / duplicate-booking check.
    //
    // The previous implementation matched on customerEmail + resource only,
    // and returned the existing bookingId in the response. An attacker who
    // knew a victim's email and a public classSessionId / eventId could
    // submit createBooking with the victim's email and receive the victim's
    // bookingId, then chain to getBooking / createRazorpayOrder for full PII.
    //
    // The fix has two parts:
    //   1. Require customerEmail AND customerPhone AND customerName to match
    //      before we consider a request a duplicate. Phone and name are not
    //      enumerable from public data, so an attacker would need all three
    //      fields for the targeted victim. Adding name only NARROWS what counts
    //      as a duplicate, so it cannot weaken the property above.
    //   2. Even on a confirmed duplicate, do NOT echo back the existing
    //      bookingId or access token (we only have the token's hash). The
    //      response is a generic 409 advising the caller to check their
    //      email. Legitimate double-click retries surface as a clear error
    //      while the original (slower) request finishes and produces the
    //      real bookingId + token.
    //
    // The attendee — not the contact details — is what is being booked. One
    // household routinely books several people from a single email and phone
    // (a parent booking for two children). Keying identity on email+phone alone
    // made the second attendee look like a duplicate of the first and blocked
    // the booking outright. Match on the name too, case-insensitively, so a
    // double-click still collapses (same name) while a genuinely different
    // attendee books normally.
    const duplicateWhere: Record<string, unknown> = {
      customerEmail: validatedData.email,
      customerPhone: validatedData.phone,
      customerName: { equals: validatedData.name, mode: "insensitive" },
      deletedAt: null,
    };
    // Only a booking that is CONFIRMED or still holding its seats counts as a
    // duplicate. An abandoned, hold-expired attempt must not dead-end the
    // customer with a 409 forever — they are entitled to book again.
    if (validatedData.type === BookingType.CLASS) {
      duplicateWhere.classSessionId = validatedData.classSessionId;
      duplicateWhere.OR = occupiesSeatWhere().OR;
    } else if (validatedData.type === BookingType.EVENT) {
      duplicateWhere.eventId = validatedData.eventId;
      duplicateWhere.OR = occupiesSeatWhere().OR;
    } else if (validatedData.type === BookingType.SPACE) {
      // SPACE bookings are created as REQUESTED (no payment). The previous
      // check keyed on the just-created spaceRequestId (always unique) AND on
      // PENDING_PAYMENT/CONFIRMED, so it never matched — SPACE requests were
      // never de-duplicated. Match an existing open SPACE request from the
      // same person instead so repeat submissions are collapsed.
      duplicateWhere.type = BookingType.SPACE;
      duplicateWhere.status = BookingStatus.REQUESTED;
    }

    const existingBooking = await prisma.booking.findFirst({
      where: duplicateWhere,
      select: {
        id: true, status: true, type: true, amountPaise: true, createdAt: true,
        holdExpiresAt: true,
        customerName: true, customerEmail: true,
      },
    });
    if (existingBooking) {
      // RESUME PAYMENT: the collision is with an existing *unpaid* CLASS/EVENT
      // booking. A match on email+phone is NOT proof of identity — both are
      // knowable about a victim — so we must not hand the caller anything that
      // unlocks the booking. Instead we email a fresh resume link to the
      // booking's OWN email address (SEC-004). The response never contains the
      // bookingId or an access token, so an attacker probing with a victim's
      // email+phone learns nothing and gains no access to their PII.
      //
      // A booking whose hold has lapsed is NOT resumable: its seats have been
      // released back to inventory (and may already be sold), so reviving it
      // would let someone pay for a seat we no longer have. The sweep above
      // will normally have flipped it to EXPIRED already; this check holds even
      // when the sweep failed.
      const isResumable =
        existingBooking.status === BookingStatus.PENDING_PAYMENT &&
        !holdHasExpired(existingBooking) &&
        (existingBooking.type === BookingType.CLASS ||
          existingBooking.type === BookingType.EVENT);

      if (isResumable) {
        // Generic, non-leaky response used for every outcome below (sent,
        // rate-limited, or send-failed). It reveals nothing about whether the
        // booking exists — the same body an attacker and the real owner see.
        const resumeEmailResponse = {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: {
              // Deliberately no bookingId / accessToken. The link is emailed.
              resumeEmailSent: true,
              requiresPayment: existingBooking.amountPaise > 0,
            },
          }),
        };

        // Bound resume emails per booking. Without this, an attacker who knows
        // the email+phone could email-bomb the victim and repeatedly rotate the
        // token out from under any in-flight checkout. Keyed on the booking id
        // (the victim's booking), not the caller's IP.
        if (await isDbRateLimited(`resume:${existingBooking.id}`, 3, 30 * 60 * 1000)) {
          return resumeEmailResponse;
        }

        // Extend the seat hold BEFORE sending. The booking is already aging —
        // its original 5-minute hold was measured from creation — so a link
        // emailed now would be dead (or expiring) by the time it is delivered,
        // read and clicked. RESUME_HOLD_MS gives the customer a realistic
        // window; createRazorpayOrder tops it up again when checkout opens.
        //
        // Safe because the hold has NOT lapsed (isResumable checked), so the
        // seat was never released back to inventory — we are keeping a
        // reservation, not taking a new one.
        const refreshedHold = await refreshHoldForResume(existingBooking);
        if (!refreshedHold) {
          // Confirmed, expired or cancelled between the read above and here.
          // Nothing to resume; don't email a link to a dead booking.
          return {
            statusCode: 409,
            headers,
            body: JSON.stringify({
              success: false,
              error:
                "Your previous booking attempt is no longer available. Please start a new booking.",
            }),
          };
        }

        // Send FIRST, persist the rotated hash only on success — so a delivery
        // failure never invalidates the customer's existing link without
        // handing them a working replacement.
        const resumeToken = generateBookingAccessToken();
        const base =
          process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
        const resumeUrl =
          `${base.replace(/\/$/, "")}/success` +
          `?bookingId=${encodeURIComponent(existingBooking.id)}` +
          `&token=${encodeURIComponent(resumeToken)}`;

        const sendResult = await sendResumePaymentLink(
          {
            id: existingBooking.id,
            customerName: existingBooking.customerName,
            customerEmail: existingBooking.customerEmail,
            amountPaise: existingBooking.amountPaise,
          },
          resumeUrl
        );

        if (sendResult.ok) {
          // Guarded like every other write on this row: a booking confirmed or
          // expired concurrently must not have its token rotated out.
          await prisma.booking.updateMany({
            where: { id: existingBooking.id, status: BookingStatus.PENDING_PAYMENT },
            data: { accessTokenHash: hashToken(resumeToken) },
          });
        }
        // On failure we already logged inside sendResumePaymentLink; still
        // return the generic body so the response can't be used to distinguish
        // "email configured" from "not", or "booking exists" from "not".
        return resumeEmailResponse;
      }

      // Already CONFIRMED, an expired hold, or an open SPACE request: nothing
      // to resume. Return a clear, non-leaky message (never echo the bookingId
      // / access token).
      const message =
        existingBooking.status === BookingStatus.CONFIRMED
          ? "You already have a confirmed booking for this. Please check your email for the confirmation."
          : existingBooking.status === BookingStatus.PENDING_PAYMENT
            ? "Your previous booking attempt expired before payment. Please start a new booking."
            : "We already have an active request from you for this. We'll be in touch shortly — please contact us if you need to make a change.";
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ success: false, error: message }),
      };
    }

    // Use a transaction with SELECT FOR UPDATE for atomic capacity check
    const booking = await prisma.$transaction(async (tx) => {
      // SEC (concurrency): serialize bookings for this resource BEFORE the
      // capacity re-check, so two requests racing for the last seat can't both
      // read a stale count and both pass. Must be the first statement in the
      // transaction. No-op for SPACE (no capacity).
      await lockResourceForBooking(tx, {
        classSessionId: validatedData.classSessionId,
        eventId: validatedData.eventId,
      });

      // Re-check capacity inside transaction to prevent race conditions
      if (validatedData.type === BookingType.CLASS && validatedData.classSessionId) {
        const cs = await tx.classSession.findUnique({
          where: { id: validatedData.classSessionId },
          select: { capacity: true },
        });
        if (cs?.capacity !== null && cs?.capacity !== undefined) {
          const agg = await tx.booking.aggregate({
            _sum: { quantity: true },
            where: {
              classSessionId: validatedData.classSessionId,
              ...occupiesSeatWhere(),
            },
          });
          if ((agg._sum.quantity ?? 0) + validatedData.quantity > cs.capacity) {
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
          const agg = await tx.booking.aggregate({
            _sum: { quantity: true },
            where: {
              eventId: validatedData.eventId,
              ...occupiesSeatWhere(),
            },
          });
          if ((agg._sum.quantity ?? 0) + validatedData.quantity > ev.capacity) {
            throw new Error("EVENT_FULL");
          }
        }
      }

      // F6: Create the SpaceRequest inside the transaction so it is atomic with
      // the Booking — if anything below throws, the row is rolled back rather
      // than orphaned.
      let spaceRequestId: string | undefined;
      if (validatedData.type === BookingType.SPACE) {
        const spaceRequest = await tx.spaceRequest.create({
          data: {
            customerName: validatedData.name,
            customerPhone: validatedData.phone,
            customerEmail: validatedData.email,
            // Guaranteed non-empty: the SPACE block above returns 400 otherwise.
            // The `?? []` only satisfies the compiler across the branch boundary.
            preferredSlots: validatedData.preferredSlots ?? [],
            notes: validatedData.notes,
            purpose: validatedData.purpose,
            status: "REQUESTED",
          },
        });
        spaceRequestId = spaceRequest.id;
      }

      // SECURITY (SEC-005, SEC-006): Generate the per-booking access token
      // inside the transaction so it is atomically attached to the row.
      const accessToken = generateBookingAccessToken();
      const accessTokenHash = hashToken(accessToken);

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
          quantity: validatedData.quantity,
          // SPACE bookings reserve no inventory, so they hold nothing.
          holdExpiresAt:
            validatedData.type === BookingType.SPACE ? null : newHoldExpiry(),
          classSessionId: validatedData.classSessionId,
          eventId: validatedData.eventId,
          spaceRequestId,
          accessTokenHash,
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

      return { booking: newBooking, accessToken };
    });

    // Notify the venue team of a new space request. Awaited (Netlify would kill
    // a detached promise once the function returns) with its own internal
    // timeout, but fully guarded — a notification failure must never fail the
    // customer's submission.
    if (validatedData.type === BookingType.SPACE) {
      try {
        await sendSpaceRequestNotification({
          bookingId: booking.booking.id,
          customerName: validatedData.name,
          customerEmail: validatedData.email,
          customerPhone: validatedData.phone,
          preferredSlots: validatedData.preferredSlots ?? [],
          purpose: validatedData.purpose,
          notes: validatedData.notes,
        });
      } catch (notifyErr) {
        console.error("Space request notification failed:", notifyErr);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          bookingId: booking.booking.id,
          // SECURITY: Raw access token is returned ONCE here and must be
          // included by the client on subsequent getBooking / createRazorpayOrder
          // calls. It is never persisted in plaintext server-side.
          accessToken: booking.accessToken,
          type: booking.booking.type,
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
