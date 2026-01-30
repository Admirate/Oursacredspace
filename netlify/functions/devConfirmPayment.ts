/**
 * DEVELOPMENT ONLY: Simulate payment confirmation
 * This endpoint allows testing the payment flow without actual Razorpay
 * 
 * SECURITY: 
 * - Requires ALLOW_DEV_ENDPOINTS=true (explicit opt-in, defaults to disabled)
 * - Requires DEV_SECRET header for authentication
 * - Never deploy with ALLOW_DEV_ENDPOINTS=true in production!
 */

import { Handler } from "@netlify/functions";
import { z } from "zod";
import { prisma } from "./helpers/prisma";
import { BookingStatus, PaymentStatus, BookingType } from "@prisma/client";
import { generateQRBuffer } from "./helpers/generateQR";
import { generateSecureId, logSecurityEvent, timingSafeCompare } from "./helpers/security";

const confirmSchema = z.object({
  bookingId: z.string().uuid(),
});

const headers = {
  "Content-Type": "application/json",
};

/**
 * SECURITY: Generate unique pass ID using cryptographically secure random bytes
 */
const generatePassId = (): string => {
  return `OSS-EV-${generateSecureId(8, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789")}`;
};

export const handler: Handler = async (event) => {
  /**
   * SECURITY: Use explicit opt-in for dev endpoints
   * - Defaults to DISABLED (secure by default)
   * - Must explicitly set ALLOW_DEV_ENDPOINTS=true to enable
   * - This is more secure than relying on NODE_ENV which may not be set correctly
   */
  if (process.env.ALLOW_DEV_ENDPOINTS !== "true") {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Not found" }),
    };
  }

  // SECURITY: Require dev secret to prevent unauthorized use
  const devSecret = process.env.DEV_SECRET;
  const providedSecret = event.headers["x-dev-secret"];
  
  // Validate both secrets exist and match using timing-safe comparison
  if (!devSecret || !providedSecret || !timingSafeCompare(providedSecret, devSecret)) {
    logSecurityEvent("AUTH_FAILURE", { 
      endpoint: "devConfirmPayment",
      reason: "invalid_dev_secret" 
    });
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Not found" }),
    };
  }

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

  try {
    const body = JSON.parse(event.body || "{}");
    const { bookingId } = confirmSchema.parse(body);

    // Get booking with payment
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (!booking) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: "Booking not found" }),
      };
    }

    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Booking status is ${booking.status}, not PENDING_PAYMENT`,
        }),
      };
    }

    const payment = booking.payments[0];
    if (!payment) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "No payment record found. Create order first.",
        }),
      };
    }

    // Update payment
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId: `pay_dev_${Date.now()}`,
        status: PaymentStatus.PAID,
        webhookEventId: `evt_dev_${Date.now()}`,
      },
    });

    // Update booking
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
        reason: "DEV MODE: Payment simulated",
      },
    });

    let passId: string | undefined;
    let qrImageUrl: string | undefined;

    // Handle EVENT booking
    if (booking.type === BookingType.EVENT && booking.eventId) {
      passId = generatePassId();
      const verifyUrl = `${process.env.APP_BASE_URL || "http://localhost:3000"}/verify?passId=${passId}`;

      // Generate QR (store as base64 for dev)
      const qrBuffer = await generateQRBuffer(verifyUrl);
      qrImageUrl = `data:image/png;base64,${qrBuffer.toString("base64")}`;

      // Create EventPass
      await prisma.eventPass.create({
        data: {
          bookingId: booking.id,
          eventId: booking.eventId,
          passId,
          qrImageUrl,
        },
      });

      // Log notification (placeholder)
      await prisma.notificationLog.create({
        data: {
          bookingId: booking.id,
          channel: "WHATSAPP",
          templateName: "booking_event_confirmed",
          to: booking.phone,
          status: "PENDING",
        },
      });
    }

    // Handle CLASS booking
    if (booking.type === BookingType.CLASS && booking.classSessionId) {
      await prisma.classSession.update({
        where: { id: booking.classSessionId },
        data: { spotsBooked: { increment: 1 } },
      });

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
      body: JSON.stringify({
        success: true,
        data: {
          bookingId: booking.id,
          status: "CONFIRMED",
          passId,
          qrImageUrl,
          message: "DEV MODE: Payment confirmed successfully",
        },
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Dev confirm error:", errorMessage);
    
    // SECURITY: Don't expose internal error messages even in dev mode
    // Log the full error but return a generic message
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to confirm payment. Check server logs for details.",
      }),
    };
  }
};
