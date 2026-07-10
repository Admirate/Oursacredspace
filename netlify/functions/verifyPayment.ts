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
    //
    // There are three distinct outcomes here, and conflating them is a money
    // bug: "confirmed" (we flipped it), "already_confirmed" (the webhook beat
    // us to it — genuinely idempotent), and "unconfirmable" (Razorpay captured
    // the payment but the booking can no longer be confirmed, e.g. it expired
    // or was cancelled while the customer sat in the checkout modal). Only the
    // first two are successes. The third means the customer has been charged
    // for nothing and needs a refund.
    const result = await prisma.$transaction(async (tx) => {
      // SEC (concurrency): verifyPayment and razorpayWebhook can run this exact
      // flow for the same payment at the same time. A read-then-write on
      // `status === CREATED` races under READ COMMITTED — both read CREATED,
      // both proceed, and the booking is confirmed twice (duplicate email +
      // duplicate statusHistory row).
      //
      // Instead, claim the payment atomically: `updateMany ... WHERE status =
      // CREATED` takes a row lock and RE-EVALUATES the predicate against the
      // latest committed row, so exactly one caller flips CREATED -> PAID and
      // gets count 1. The loser gets count 0 and runs no side effects.
      const claim = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.CREATED },
        data: { razorpayPaymentId, status: PaymentStatus.PAID },
      });

      if (claim.count === 0) {
        // We lost the race, or the payment was never CREATED. Report the real
        // state so the caller can distinguish idempotent success from a
        // captured-but-unconfirmable charge.
        const [p, b] = await Promise.all([
          tx.payment.findUnique({ where: { id: payment.id }, select: { status: true } }),
          tx.booking.findUnique({ where: { id: booking.id }, select: { status: true } }),
        ]);
        if (p?.status === PaymentStatus.PAID && b?.status === BookingStatus.CONFIRMED) {
          return { outcome: "already_confirmed" as const };
        }
        return {
          outcome: "unconfirmable" as const,
          paymentStatus: p?.status ?? null,
          bookingStatus: b?.status ?? null,
        };
      }

      // We won the claim and the payment is now PAID. Confirm the booking, but
      // only if it is still awaiting payment — it may have expired/cancelled
      // while the customer sat in checkout. Guard the booking update the same
      // way so a concurrent state change can't be clobbered.
      const confirm = await tx.booking.updateMany({
        where: { id: booking.id, status: BookingStatus.PENDING_PAYMENT },
        data: { status: BookingStatus.CONFIRMED },
      });

      if (confirm.count === 0) {
        // Captured, but the booking can't be confirmed. Payment is correctly
        // PAID (the money was taken); the unconfirmable handler below records
        // the refund trail. Re-read the booking status for the audit row.
        const b = await tx.booking.findUnique({
          where: { id: booking.id },
          select: { status: true },
        });
        return {
          outcome: "unconfirmable" as const,
          paymentStatus: PaymentStatus.PAID,
          bookingStatus: b?.status ?? null,
        };
      }

      await tx.statusHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: BookingStatus.PENDING_PAYMENT,
          toStatus: BookingStatus.CONFIRMED,
          changedBy: "SYSTEM",
          reason: "Payment verified via checkout handler",
        },
      });

      return { outcome: "confirmed" as const };
    });

    // 6. Captured, but the booking cannot be confirmed. Do not tell the
    //    customer this succeeded. Leave a reconciliation trail so support can
    //    find the payment, and raise a Sentry alert for the refund.
    if (result.outcome === "unconfirmable") {
      // Attach the Razorpay payment id to our Payment row so the charge is
      // traceable from the booking. updateMany (not update) so a row that
      // already carries an id is a no-op rather than a unique-constraint throw.
      await prisma.payment
        .updateMany({
          where: { id: payment.id, razorpayPaymentId: null },
          data: { razorpayPaymentId },
        })
        .catch((e) => {
          logger.error("Could not attach razorpayPaymentId to unconfirmable payment", e, {
            bookingId: booking.id,
            razorpayPaymentId,
          });
        });

      await prisma.statusHistory
        .create({
          data: {
            bookingId: booking.id,
            fromStatus: result.bookingStatus ?? "UNKNOWN",
            toStatus: result.bookingStatus ?? "UNKNOWN",
            changedBy: "SYSTEM",
            reason: `REFUND REQUIRED: payment ${razorpayPaymentId} captured against booking in status ${result.bookingStatus ?? "UNKNOWN"}`,
          },
        })
        .catch((e) => {
          logger.error("Could not write refund-required audit row", e, { bookingId: booking.id });
        });

      logger.payment("anomaly", {
        type: "captured_payment_unconfirmable_booking",
        bookingId: booking.id,
        razorpayOrderId,
        razorpayPaymentId,
        bookingStatus: result.bookingStatus,
        paymentStatus: result.paymentStatus,
      });

      logSecurityEvent("SUSPICIOUS_REQUEST", {
        type: "captured_payment_unconfirmable_booking",
        bookingId: booking.id,
        razorpayOrderId,
      });

      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          success: false,
          error:
            "Your payment was received, but this booking is no longer available to confirm. " +
            "We have logged this and a refund will be issued. Please contact support with " +
            `payment reference ${razorpayPaymentId}.`,
        }),
      };
    }

    // 7. Fire-and-forget notifications. The booking is already CONFIRMED;
    //    a notification failure must not bubble up to the user. Skipped when
    //    the webhook won the race, since it already sent the confirmation.
    if (result.outcome === "confirmed") {
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
          alreadyProcessed: result.outcome === "already_confirmed",
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
