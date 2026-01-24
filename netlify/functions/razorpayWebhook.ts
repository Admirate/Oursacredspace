import { Handler } from "@netlify/functions";
import crypto from "crypto";
import { prisma } from "./helpers/prisma";
import { BookingStatus, PaymentStatus, BookingType } from "@prisma/client";
import { generateQRBuffer } from "./helpers/generateQR";
import { uploadQrToSupabase } from "./helpers/uploadQrToSupabase";
// TODO: Uncomment when WhatsApp is configured
// import { sendEventConfirmation, sendClassConfirmation } from "./helpers/sendWhatsApp";

const headers = {
  "Content-Type": "application/json",
};

// Generate unique pass ID
const generatePassId = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "OSS-EV-";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Verify Razorpay webhook signature
const verifySignature = (body: string, signature: string, secret: string): boolean => {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return expectedSignature === signature;
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
      // Log attempt but don't reveal details
      console.error("SECURITY: Invalid webhook signature attempt");
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    const payload = JSON.parse(webhookBody);
    const eventType = payload.event;

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

    // Idempotency check
    if (payment.razorpayPaymentId === razorpayPaymentId) {
      console.log(`Webhook already processed for payment: ${razorpayPaymentId}`);
      return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
    }

    const booking = payment.booking;

    // Handle payment captured (success)
    if (eventType === "payment.captured" || paymentStatus === "captured") {
      // Update payment
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          razorpayPaymentId,
          status: PaymentStatus.PAID,
          webhookEventId: payload.event_id || `evt_${Date.now()}`,
          rawPayload: payload,
        },
      });

      // Update booking status
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CONFIRMED },
      });

      // Record status change
      await prisma.statusHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: BookingStatus.PENDING_PAYMENT,
          toStatus: BookingStatus.CONFIRMED,
          changedBy: "SYSTEM",
          reason: "Payment successful",
        },
      });

      // === Handle EVENT booking: Generate pass + QR ===
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

      // === Handle CLASS booking ===
      if (booking.type === BookingType.CLASS && booking.classSessionId) {
        // Increment spots booked
        await prisma.classSession.update({
          where: { id: booking.classSessionId },
          data: { spotsBooked: { increment: 1 } },
        });

        // TODO: Send WhatsApp notification
        // Log notification (placeholder)
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
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          razorpayPaymentId,
          status: PaymentStatus.FAILED,
          webhookEventId: payload.event_id || `evt_${Date.now()}`,
          rawPayload: payload,
        },
      });

      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.PAYMENT_FAILED },
      });

      await prisma.statusHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: BookingStatus.PENDING_PAYMENT,
          toStatus: BookingStatus.PAYMENT_FAILED,
          changedBy: "SYSTEM",
          reason: "Payment failed",
        },
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
    // Always return 200 to prevent retries for parsing errors
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true, error: "Processing error" }),
    };
  }
};
