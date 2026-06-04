import { Handler } from "@netlify/functions";
import crypto from "crypto";
import { prisma } from "./helpers/prisma";
import { BookingStatus, PaymentStatus, BookingType, Prisma } from "@prisma/client";
import { logSecurityEvent } from "./helpers/security";
import { logger, withSentry } from "./helpers/logger";
import { sendBookingConfirmation } from "./helpers/notifications";

/**
 * SECURITY (SEC-022): Strip sensitive / PCI-adjacent fields from webhook
 * payloads before persisting. We keep only the fields needed for audit
 * trails and dispute resolution.
 */
const sanitizeWebhookPayload = (
  raw: Record<string, unknown>
): Prisma.InputJsonValue => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entity = (raw as any).payload?.payment?.entity;
  return {
    event: raw.event,
    event_id: raw.event_id,
    account_id: raw.account_id,
    created_at: raw.created_at,
    payment: entity
      ? {
          id: entity.id,
          order_id: entity.order_id,
          status: entity.status,
          amount: entity.amount,
          currency: entity.currency,
          method: entity.method,
          captured: entity.captured,
          error_code: entity.error_code,
          error_reason: entity.error_reason,
        }
      : undefined,
  } as Prisma.InputJsonValue;
};

const headers = {
  "Content-Type": "application/json",
};

/**
 * SECURITY: Verify Razorpay webhook signature using timing-safe comparison
 * Prevents timing attacks on signature verification
 */
const verifySignature = (body: string, signature: string, secret: string): boolean => {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    // If signatures have different lengths, they don't match
    return false;
  }
};

const _handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const webhookBody = event.body || "";
    const webhookSignature = event.headers["x-razorpay-signature"] || "";
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // SECURITY: Verify webhook signature to prevent spoofing
    if (!webhookSecret) {
      logger.error("RAZORPAY_WEBHOOK_SECRET env var is not set");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Server configuration error" }),
      };
    }

    if (!webhookSignature || !verifySignature(webhookBody, webhookSignature, webhookSecret)) {
      // SECURITY: Log attempt but don't reveal details
      logSecurityEvent("INVALID_SIGNATURE", { 
        endpoint: "razorpayWebhook",
        hasSignature: !!webhookSignature 
      });
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    let payload: Record<string, unknown> & Prisma.InputJsonValue;
    try {
      payload = JSON.parse(webhookBody);
    } catch {
      logger.error("Webhook body JSON parse failed", new Error("Invalid JSON"), {
        bodyLength: webhookBody.length,
      });
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Invalid payload" }) };
    }
    const eventType = payload.event as string | undefined;
    const webhookEventId = payload.event_id as string | undefined;

    // Only handle payment events
    if (!eventType?.startsWith("payment.")) {
      return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paymentEntity = (payload as any).payload?.payment?.entity;
    if (!paymentEntity) {
      return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
    }

    const {
      id: razorpayPaymentId,
      order_id: razorpayOrderId,
      status: paymentStatus,
      amount: webhookAmount,
      currency: webhookCurrency,
    } = paymentEntity;

    // Find payment by order ID
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

    if (!payment) {
      logger.warn("Payment not found for order", { razorpayOrderId });
      return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
    }

    const booking = payment.booking;

    // SECURITY: Idempotency check using webhookEventId (more reliable than paymentId)
    if (payment.webhookEventId && payment.webhookEventId === webhookEventId) {
      logger.info("Webhook already processed (idempotent)", { webhookEventId });
      return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
    }

    // SECURITY: Also check razorpayPaymentId for backwards compatibility
    if (payment.razorpayPaymentId === razorpayPaymentId) {
      logger.info("Payment already processed", { razorpayPaymentId });
      return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
    }

    // SECURITY: Validate payment amount matches expected amount
    if (webhookAmount !== payment.amountPaise) {
      logger.payment("anomaly", {
        type: "amount_mismatch",
        expected: payment.amountPaise,
        received: webhookAmount,
        orderId: razorpayOrderId,
        bookingId: booking.id,
      });
      logSecurityEvent("SUSPICIOUS_REQUEST", {
        type: "amount_mismatch",
        expected: payment.amountPaise,
        received: webhookAmount,
        orderId: razorpayOrderId,
      });
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: "Amount mismatch" }) 
      };
    }

    // SECURITY: Validate currency matches
    if (webhookCurrency && webhookCurrency.toUpperCase() !== payment.currency.toUpperCase()) {
      logger.payment("anomaly", {
        type: "currency_mismatch",
        expected: payment.currency,
        received: webhookCurrency,
        orderId: razorpayOrderId,
      });
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: "Currency mismatch" }) 
      };
    }

    // SECURITY: Validate booking status before processing
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      logger.warn("Booking not in PENDING_PAYMENT state", { bookingId: booking.id, status: booking.status });
      // Return 200 to prevent retries, but don't process
      return { statusCode: 200, headers, body: JSON.stringify({ received: true, skipped: true }) };
    }

    // SECURITY: Validate payment status before updating
    if (payment.status !== PaymentStatus.CREATED) {
      logger.warn("Payment already processed", { paymentId: payment.id, status: payment.status });
      return { statusCode: 200, headers, body: JSON.stringify({ received: true, skipped: true }) };
    }

    // Handle payment captured (success)
    if (eventType === "payment.captured" || paymentStatus === "captured") {
      // SECURITY: Use database transaction to ensure atomicity
      // This prevents race conditions where concurrent webhooks could cause double processing
      const result = await prisma.$transaction(async (tx) => {
        // Double-check payment status inside transaction (prevents race condition)
        const currentPayment = await tx.payment.findUnique({
          where: { id: payment.id },
          select: { status: true, razorpayPaymentId: true },
        });
        
        if (currentPayment?.status !== PaymentStatus.CREATED) {
          return { skipped: true, reason: "Payment already processed" };
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            razorpayPaymentId,
            status: PaymentStatus.PAID,
            webhookEventId: webhookEventId || `evt_${razorpayOrderId}_${Date.now()}`,
            rawPayload: sanitizeWebhookPayload(payload),
          },
        });

        // Update booking status
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
            reason: "Payment successful",
          },
        });

        // Inventory ledger: availability is derived from booking count.
        // No need to increment spotsBooked — the CONFIRMED booking itself IS the record.

        return { skipped: false };
      });

      // If transaction was skipped (already processed), return early
      if (result.skipped) {
        logger.info("Payment transaction skipped", { reason: result.reason });
        return { statusCode: 200, headers, body: JSON.stringify({ received: true, skipped: true }) };
      }

      // === Send confirmation notifications (email + WhatsApp) ===
      // Notifications are best-effort; booking is already confirmed at this point.
      try {
        await sendBookingConfirmation(booking);
      } catch (notifError) {
        logger.error("Notification sending failed after payment confirmed", notifError, {
          bookingId: booking.id,
          customerEmail: booking.customerEmail,
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ received: true, processed: true }),
      };
    }

    // Handle payment failed
    if (eventType === "payment.failed") {
      logger.payment("failed", { orderId: razorpayOrderId, bookingId: booking.id, razorpayPaymentId });
      // SECURITY: Use transaction for atomicity; re-check status to prevent
      // overwriting a CONFIRMED booking from a stale failure webhook
      await prisma.$transaction(async (tx) => {
        const currentBooking = await tx.booking.findUnique({
          where: { id: booking.id },
          select: { status: true },
        });

        const currentPayment = await tx.payment.findUnique({
          where: { id: payment.id },
          select: { status: true },
        });

        // Only mark failed if booking is still pending and payment hasn't been processed
        if (
          currentBooking?.status !== BookingStatus.PENDING_PAYMENT ||
          currentPayment?.status !== PaymentStatus.CREATED
        ) {
          logger.info("Skipping payment.failed — booking/payment already processed", {
            bookingStatus: currentBooking?.status,
            paymentStatus: currentPayment?.status,
          });
          return;
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            razorpayPaymentId,
            status: PaymentStatus.FAILED,
            webhookEventId: webhookEventId || `evt_${razorpayOrderId}_${Date.now()}`,
            rawPayload: sanitizeWebhookPayload(payload),
          },
        });

        await tx.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.PAYMENT_FAILED },
        });

        await tx.statusHistory.create({
          data: {
            bookingId: booking.id,
            fromStatus: BookingStatus.PENDING_PAYMENT,
            toStatus: BookingStatus.PAYMENT_FAILED,
            changedBy: "SYSTEM",
            reason: "Payment failed",
          },
        });
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ received: true, processed: true }),
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "";
    logger.error("razorpayWebhook unhandled error", error);

    // SECURITY: Return 500 for transient errors to allow Razorpay retries
    // Return 200 only for permanent failures (parsing errors, etc.)
    const isTransientError = errorMessage.includes("connection") ||
                             errorMessage.includes("timeout") ||
                             errorMessage.includes("ECONNREFUSED");

    if (isTransientError) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Temporary error, please retry" }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ received: true, error: "Processing error" }) };
  }
};

export const handler = withSentry("razorpayWebhook", _handler);
