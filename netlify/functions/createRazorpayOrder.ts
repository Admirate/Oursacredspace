import { Handler } from "@netlify/functions";
import { z } from "zod";
import { prisma } from "./helpers/prisma";
import { BookingStatus, PaymentStatus } from "@prisma/client";
import { getClientIP, isRateLimited, rateLimitResponse } from "./helpers/security";

// TODO: Uncomment when Razorpay credentials are available
// import Razorpay from "razorpay";
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID!,
//   key_secret: process.env.RAZORPAY_KEY_SECRET!,
// });

const createOrderSchema = z.object({
  bookingId: z.string().uuid(),
});

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const handler: Handler = async (event) => {
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

  // SECURITY: Rate limit order creation (5 per minute per IP)
  const clientIP = getClientIP(event);
  if (isRateLimited(`order:${clientIP}`, 5, 60000)) {
    return rateLimitResponse();
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { bookingId } = createOrderSchema.parse(body);

    // Get booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
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
          error: `Cannot create order for booking with status: ${booking.status}`,
        }),
      };
    }

    // ============================================
    // PLACEHOLDER: Razorpay Order Creation
    // ============================================
    // When you have Razorpay credentials, uncomment this:
    /*
    const razorpayOrder = await razorpay.orders.create({
      amount: booking.amountPaise,
      currency: booking.currency,
      receipt: booking.id,
      notes: {
        bookingId: booking.id,
        type: booking.type,
      },
    });
    */

    // MOCK ORDER for development (remove when using real Razorpay)
    const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        provider: "RAZORPAY",
        razorpayOrderId: mockOrderId, // Replace with razorpayOrder.id
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
          orderId: mockOrderId, // Replace with razorpayOrder.id
          keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
          amount: booking.amountPaise,
          currency: booking.currency,
          bookingId: booking.id,
          customerName: booking.name,
          customerEmail: booking.email,
          customerPhone: booking.phone,
          // For development: Auto-confirm after "payment"
          _dev_note: "DEVELOPMENT MODE: Payment will auto-confirm",
        },
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
        error: "Failed to create payment order",
      }),
    };
  }
};
