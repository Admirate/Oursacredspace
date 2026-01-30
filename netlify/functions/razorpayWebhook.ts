import { Handler } from "@netlify/functions";
import crypto from "crypto";
import { prisma } from "./helpers/prisma";
import { BookingStatus, PaymentStatus, BookingType } from "@prisma/client";
import { generateQRBuffer } from "./helpers/generateQR";
import { uploadQrToSupabase } from "./helpers/uploadQrToSupabase";
import { generateSecureId, logSecurityEvent } from "./helpers/security";
// TODO: Uncomment when WhatsApp is configured
// import { sendEventConfirmation, sendClassConfirmation } from "./helpers/sendWhatsApp";

const headers = {
  "Content-Type": "application/json",
};

/**
 * SECURITY: Generate unique pass ID using cryptographically secure random bytes
 * Using crypto.randomBytes instead of Math.random() for unpredictability
 */
const generatePassId = (): string => {
  return `OSS-EV-${generateSecureId(8, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789")}`;
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

export const handler: Handler = async (event) => {
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
      console.error("SECURITY: RAZORPAY_WEBHOOK_SECRET env var is not set!");
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

    const payload = JSON.parse(webhookBody);
    const eventType = payload.event;
    const webhookEventId = payload.event_id;

    // Only handle payment events
    if (!eventType?.startsWith("payment.")) {
      return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
    }

    const paymentEntity = payload.payload?.payment?.entity;
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
      include: { booking: true },
    });

    if (!payment) {
      console.error(`Payment not found for order: ${razorpayOrderId}`);
      return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
    }

    const booking = payment.booking;

    // SECURITY: Idempotency check using webhookEventId (more reliable than paymentId)
    if (payment.webhookEventId && payment.webhookEventId === webhookEventId) {
      console.log(`Webhook already processed: ${webhookEventId}`);
      return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
    }

    // SECURITY: Also check razorpayPaymentId for backwards compatibility
    if (payment.razorpayPaymentId === razorpayPaymentId) {
      console.log(`Payment already processed: ${razorpayPaymentId}`);
      return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
    }

    // SECURITY: Validate payment amount matches expected amount
    if (webhookAmount !== payment.amountPaise) {
      console.error("SECURITY: Amount mismatch!", {
        expected: payment.amountPaise,
        received: webhookAmount,
        orderId: razorpayOrderId,
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
      console.error("SECURITY: Currency mismatch!", {
        expected: payment.currency,
        received: webhookCurrency,
      });
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: "Currency mismatch" }) 
      };
    }

    // SECURITY: Validate booking status before processing
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      console.warn(`Booking ${booking.id} is not pending payment, status: ${booking.status}`);
      // Return 200 to prevent retries, but don't process
      return { statusCode: 200, headers, body: JSON.stringify({ received: true, skipped: true }) };
    }

    // SECURITY: Validate payment status before updating
    if (payment.status !== PaymentStatus.CREATED) {
      console.warn(`Payment ${payment.id} already processed, status: ${payment.status}`);
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

        // Update payment
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            razorpayPaymentId,
            status: PaymentStatus.PAID,
            webhookEventId: webhookEventId || `evt_${razorpayOrderId}_${Date.now()}`,
            rawPayload: payload,
          },
        });

        // Update booking status
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.CONFIRMED },
        });

        // Record status change
        await tx.statusHistory.create({
          data: {
            bookingId: booking.id,
            fromStatus: BookingStatus.PENDING_PAYMENT,
            toStatus: BookingStatus.CONFIRMED,
            changedBy: "SYSTEM",
            reason: "Payment successful",
          },
        });

        // === Handle CLASS booking ===
        if (booking.type === BookingType.CLASS && booking.classSessionId) {
          // SECURITY: Check capacity before incrementing to prevent overbooking
          const classSession = await tx.classSession.findUnique({
            where: { id: booking.classSessionId },
            select: { capacity: true, spotsBooked: true },
          });

          if (classSession && classSession.spotsBooked >= classSession.capacity) {
            // Class is full - this shouldn't happen but handle gracefully
            console.error(`Class ${booking.classSessionId} is at capacity!`);
            // Still confirm the booking but log the issue
          } else {
            // Increment spots booked
            await tx.classSession.update({
              where: { id: booking.classSessionId },
              data: { spotsBooked: { increment: 1 } },
            });
          }
        }

        return { skipped: false };
      });

      // If transaction was skipped (already processed), return early
      if (result.skipped) {
        console.log(`Payment already processed: ${result.reason}`);
        return { statusCode: 200, headers, body: JSON.stringify({ received: true, skipped: true }) };
      }

      // === Handle EVENT booking: Generate pass + QR (outside transaction for performance) ===
      if (booking.type === BookingType.EVENT && booking.eventId) {
        const passId = generatePassId();
        const verifyUrl = `${process.env.APP_BASE_URL || "http://localhost:3000"}/verify?passId=${passId}`;

        // Generate QR code
        const qrBuffer = await generateQRBuffer(verifyUrl);

        // Upload to Supabase (if configured)
        let qrImageUrl = "";
        try {
          qrImageUrl = await uploadQrToSupabase(qrBuffer, booking.eventId, passId);
        } catch (uploadError) {
          console.error("QR upload failed:", uploadError);
          // Use a placeholder URL for development
          qrImageUrl = `${process.env.APP_BASE_URL || "http://localhost:3000"}/api/qr/${passId}`;
        }

        // Create EventPass
        await prisma.eventPass.create({
          data: {
            bookingId: booking.id,
            eventId: booking.eventId,
            passId,
            qrImageUrl,
          },
        });

        // TODO: Send WhatsApp notification
        // Uncomment when WhatsApp is configured:
        /*
        const event = await prisma.event.findUnique({ where: { id: booking.eventId } });
        if (event) {
          await sendEventConfirmation({
            to: booking.phone,
            name: booking.name,
            eventTitle: event.title,
            datetime: event.startsAt.toISOString(),
            venue: event.venue,
            passId,
            qrImageUrl,
          });
        }
        */

        // Log notification (placeholder)
        await prisma.notificationLog.create({
          data: {
            bookingId: booking.id,
            channel: "WHATSAPP",
            templateName: "booking_event_confirmed",
            to: booking.phone,
            status: "PENDING", // Would be SENT when WhatsApp is configured
          },
        });
      }

      // Log notification for CLASS booking (outside transaction)
      if (booking.type === BookingType.CLASS && booking.classSessionId) {
        await prisma.notificationLog.create({
          data: {
            bookingId: booking.id,
            channel: "WHATSAPP",
            templateName: "booking_class_confirmed",
            to: booking.phone,
            status: "PENDING",
          },
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
      // SECURITY: Use transaction for atomicity
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            razorpayPaymentId,
            status: PaymentStatus.FAILED,
            webhookEventId: webhookEventId || `evt_${razorpayOrderId}_${Date.now()}`,
            rawPayload: payload,
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", errorMessage);
    
    // SECURITY: Return 500 for transient errors to allow Razorpay retries
    // Return 200 only for permanent failures (parsing errors, etc.)
    const isTransientError = errorMessage.includes("connection") || 
                             errorMessage.includes("timeout") ||
                             errorMessage.includes("ECONNREFUSED");
    
    if (isTransientError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Temporary error, please retry" }),
      };
    }
    
    // Permanent failure - return 200 to prevent infinite retries
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true, error: "Processing error" }),
    };
  }
};
