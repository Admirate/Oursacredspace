import { Handler } from "@netlify/functions";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "./helpers/prisma";
import { BookingStatus, PaymentStatus } from "@prisma/client";
import {
  getClientIP,
  rateLimitResponse,
  RATE_LIMITS,
  getPublicHeaders,
  hashToken,
  logSecurityEvent,
} from "./helpers/security";
import { isDbRateLimited } from "./helpers/dbRateLimit";
import { logger, withSentry } from "./helpers/logger";
import { sendBookingConfirmation } from "./helpers/notifications";

/**
 * SECURITY: Server-side verification of the Razorpay checkout `handler`
 * signature.
 *
 * Razorpay's Standard Checkout integration mandates:
 *   HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, KEY_SECRET)
 *     === razorpay_signature
 *
 * This endpoint is the synchronous companion to `razorpayWebhook` — both
 * paths idempotently mark the booking CONFIRMED. Whichever wins the race
 * (usually this one, since the browser hits us before Razorpay fires the
 * webhook) flips the state; the other is a no-op thanks to the
 * transactional `payment.status === CREATED` guard.
 */

const verifyPaymentSchema = z.object({
  bookingId: z.string().min(1).max(30),
  accessToken: z
    .string()
    .min(40)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid accessToken format"),
  razorpayOrderId: z.string().min(1).max(64),
  razorpayPaymentId: z.string().min(1).max(64),
  razorpaySignature: z
    .string()
    .min(64)
    .max(128)
    .regex(/^[a-f0-9]+$/i, "Invalid signature format"),
});

const verifyRazorpaySignature = (
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean => {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
};

const _handler: Handler = async (event) => {
  const headers = getPublicHeaders(event, "POST, OPTIONS");

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

  const clientIP = getClientIP(event);
  if (
    await isDbRateLimited(
      `verifyPayment:${clientIP}`,
      RATE_LIMITS.PAYMENT.maxRequests,
      RATE_LIMITS.PAYMENT.windowMs
    )
  ) {
    return rateLimitResponse();
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    logger.error("RAZORPAY_KEY_SECRET env var is not set");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: "Server configuration error" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const {
      bookingId,
      accessToken,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = verifyPaymentSchema.parse(body);

    // 1. Authenticate the caller against the booking using the per-booking
    //    accessToken (mirrors createRazorpayOrder).
    const accessTokenHash = hashToken(accessToken);
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, accessTokenHash },
      select: { id: true, status: true, customerEmail: true, customerPhone: true, type: true },
    });

    if (!booking) {
      // Generic 404 — never leak whether bookingId or token was wrong
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: "Booking not found" }),
      };
    }

    // 2. Locate the Payment row by Razorpay order id and ensure it belongs
    //    to this booking (defends against an attacker pairing a stolen
    //    payment_id with a different booking's accessToken).
    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId },
      include: {
        booking: {
          include: {
            classSession: { select: { title: true, startsAt: true, location: true, duration: true } },
            event: { select: { title: true, startsAt: true, venue: true, endsAt: true } },
          },
        },
      },
    });

    if (!payment || payment.bookingId !== booking.id) {
      logSecurityEvent("SUSPICIOUS_REQUEST", {
        type: "verifyPayment_order_booking_mismatch",
        bookingId,
        razorpayOrderId,
      });
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: "Payment not found" }),
      };
    }

    // 3. Verify the Razorpay signature (the cryptographic proof of payment).
    const signatureValid = verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      keySecret
    );

    if (!signatureValid) {
      logSecurityEvent("INVALID_SIGNATURE", {
        endpoint: "verifyPayment",
        bookingId,
        razorpayOrderId,
      });
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: "Invalid payment signature" }),
      };
    }

    // 4. Idempotent confirmation. If the webhook already processed this
    //    payment, return success without re-running side effects.
    if (
      payment.status === PaymentStatus.PAID &&
      payment.booking.status === BookingStatus.CONFIRMED
    ) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: { bookingId: booking.id, status: "CONFIRMED", alreadyProcessed: true },
        }),
      };
    }

    // 5. Atomic update — mirrors razorpayWebhook's payment.captured flow.
    const result = await prisma.$transaction(async (tx) => {
      const currentPayment = await tx.payment.findUnique({
        where: { id: payment.id },
        select: { status: true },
      });

      if (currentPayment?.status !== PaymentStatus.CREATED) {
        return { skipped: true as const };
      }

      const currentBooking = await tx.booking.findUnique({
        where: { id: booking.id },
        select: { status: true },
      });

      if (currentBooking?.status !== BookingStatus.PENDING_PAYMENT) {
        return { skipped: true as const };
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          razorpayPaymentId,
          status: PaymentStatus.PAID,
        },
      });

      await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CONFIRMED },
      });

      await tx.statusHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: BookingStatus.PENDING_PAYMENT,
          toStatus: BookingStatus.CONFIRMED,
          changedBy: "SYSTEM",
          reason: "Payment verified via checkout handler",
        },
      });

      return { skipped: false as const };
    });

    // 6. Fire-and-forget notifications. The booking is already CONFIRMED;
    //    a notification failure must not bubble up to the user.
    if (!result.skipped) {
      try {
        await sendBookingConfirmation(payment.booking);
      } catch (notifErr) {
        logger.error("Notification send failed after verifyPayment", notifErr, {
          bookingId: booking.id,
        });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          bookingId: booking.id,
          status: "CONFIRMED",
          alreadyProcessed: result.skipped,
        },
      }),
    };
  } catch (error) {
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

    logger.error("verifyPayment unhandled error", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to verify payment. Please contact support if you were charged.",
      }),
    };
  }
};

export const handler = withSentry("verifyPayment", _handler);
