/**
 * DEVELOPMENT ONLY: Simulate payment confirmation
 * This endpoint allows testing the payment flow without actual Razorpay
 * SECURITY: Requires DEV_SECRET header and NODE_ENV !== production
 */

import { Handler } from "@netlify/functions";
import { z } from "zod";
import { prisma } from "./helpers/prisma";
import { BookingStatus, PaymentStatus, BookingType } from "@prisma/client";
import { generateQRBuffer } from "./helpers/generateQR";

const confirmSchema = z.object({
  bookingId: z.string().uuid(),
});

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

export const handler: Handler = async (event) => {
  // SECURITY: Only allow in development mode
  if (process.env.NODE_ENV === "production") {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Not found" }),
    };
  }

  // SECURITY: Require dev secret to prevent unauthorized use
  const devSecret = process.env.DEV_SECRET;
  const providedSecret = event.headers["x-dev-secret"];
  if (!devSecret || providedSecret !== devSecret) {
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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage || "Failed to confirm payment",
      }),
    };
  }
};
