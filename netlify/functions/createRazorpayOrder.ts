import { Handler } from "@netlify/functions";
import { z } from "zod";
import { prisma } from "./helpers/prisma";
import { BookingStatus, PaymentStatus } from "@prisma/client";
import {
  getClientIP,
  rateLimitResponse,
  RATE_LIMITS,
  getPublicHeaders,
  hashToken,
} from "./helpers/security";
import { isDbRateLimited } from "./helpers/dbRateLimit";
import { withSentry } from "./helpers/logger";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// SECURITY (SEC-006): accessToken is REQUIRED. Without a matching token an
// unauthenticated caller with a guessed booking ID can no longer create an
// order or harvest customerName / customerEmail / customerPhone from the
// response.
const createOrderSchema = z.object({
  bookingId: z.string().min(1).max(30),
  accessToken: z
    .string()
    .min(40)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid accessToken format"),
});

const NOT_FOUND_RESPONSE = (
  headers: Record<string, string>
): { statusCode: number; headers: Record<string, string>; body: string } => ({
  statusCode: 404,
  headers,
  body: JSON.stringify({ success: false, error: "Booking not found" }),
});

const _handler: Handler = async (event) => {
  // SECURITY: Use origin-validated CORS headers
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

  // SECURITY: Rate limit payment order creation
  const clientIP = getClientIP(event);
  if (await isDbRateLimited(`order:${clientIP}`, RATE_LIMITS.PAYMENT.maxRequests, RATE_LIMITS.PAYMENT.windowMs)) {
    return rateLimitResponse();
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { bookingId, accessToken } = createOrderSchema.parse(body);

    // SECURITY (SEC-006): Look up the booking by id AND accessTokenHash.
    // Any mismatch (wrong booking, wrong token, or legacy booking without
    // a hash) returns a generic 404 -- the response body and timing must
    // not leak which condition failed.
    const accessTokenHash = hashToken(accessToken);
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, accessTokenHash },
      select: {
        id: true, status: true, type: true,
        amountPaise: true, currency: true,
        customerName: true, customerEmail: true, customerPhone: true,
      },
    });

    if (!booking) {
      return NOT_FOUND_RESPONSE(headers);
    }

    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "This booking is not eligible for payment. It may have already been paid or expired.",
        }),
      };
    }

    // Prevent double-charging: reuse an existing unpaid order if one exists
    const existingPayment = await prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        status: PaymentStatus.CREATED,
      },
      orderBy: { createdAt: "desc" },
      select: { razorpayOrderId: true, amountPaise: true, currency: true },
    });

    if (existingPayment) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            orderId: existingPayment.razorpayOrderId,
            keyId: process.env.RAZORPAY_KEY_ID,
            amount: existingPayment.amountPaise,
            currency: existingPayment.currency,
            bookingId: booking.id,
            customerName: booking.customerName,
            customerEmail: booking.customerEmail,
            customerPhone: booking.customerPhone,
          },
        }),
      };
    }

    // payment_capture: 1 forces auto-capture so funds are settled the
    // moment Razorpay marks the payment captured. This is the
    // Razorpay-recommended setting for one-shot booking flows; relying on
    // the account-level default is fragile because an admin can change it.
    const razorpayOrder = await razorpay.orders.create({
      amount: booking.amountPaise,
      currency: booking.currency,
      receipt: booking.id,
      payment_capture: true,
      notes: {
        bookingId: booking.id,
        type: booking.type,
      },
    });

    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        provider: "RAZORPAY",
        razorpayOrderId: razorpayOrder.id,
        status: PaymentStatus.CREATED,
        amountPaise: booking.amountPaise,
        currency: booking.currency,
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          orderId: razorpayOrder.id,
          keyId: process.env.RAZORPAY_KEY_ID,
          amount: booking.amountPaise,
          currency: booking.currency,
          bookingId: booking.id,
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          customerPhone: booking.customerPhone,
        },
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Create order error:", errorMessage);

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
        error: "Failed to create payment order. Please try again.",
      }),
    };
  }
};

export const handler = withSentry("createRazorpayOrder", _handler);
