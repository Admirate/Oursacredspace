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
import { logger, withSentry } from "./helpers/logger";
import { holdHasExpired, ensureCheckoutWindow } from "./helpers/bookingHold";
import Razorpay from "razorpay";

/**
 * Credentials are read per request (and trimmed) rather than captured at module
 * load. A stray quote or newline in a dashboard-set env var produces a
 * syntactically-valid but unusable key; Razorpay answers 401 to the browser's
 * checkout `preferences` call, which surfaces as an opaque
 * "Oops! Something went wrong. Payment Failed" long after we returned 200.
 */
const getRazorpayCredentials = (): { keyId: string; keySecret: string } | null => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
};

const makeRazorpay = (creds: { keyId: string; keySecret: string }): Razorpay =>
  new Razorpay({ key_id: creds.keyId, key_secret: creds.keySecret });

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

type StoredOrder = { razorpayOrderId: string; amountPaise: number; currency: string };
/** `alreadyPaid` is only meaningful when `reuse` is false. */
type OrderVerdict = { reuse: boolean; alreadyPaid: boolean };

/**
 * Decide whether a Razorpay order we created earlier can still be handed to
 * checkout *under the credentials this environment is serving with*.
 *
 * We used to reuse a stored `razorpayOrderId` on the strength of our own
 * Payment row alone, pairing it with whatever RAZORPAY_KEY_ID happened to be in
 * the environment. Those two can disagree — an order created against one
 * account/key retried by an environment holding another (or a malformed) key.
 * Razorpay then rejects the (order_id, key) pair with 401 inside the browser,
 * which the user sees as "Oops! Something went wrong. Payment Failed".
 *
 * Fetching the order proves it exists, belongs to these credentials, still
 * expects the amount we think it does, and has not already been paid. Anything
 * else means: do not reuse — mint a fresh order under the current credentials.
 */
const classifyExistingOrder = async (
  razorpay: Razorpay,
  stored: StoredOrder,
  bookingId: string
): Promise<OrderVerdict> => {
  let order: { status?: string; amount?: number | string; currency?: string };
  try {
    order = await razorpay.orders.fetch(stored.razorpayOrderId);
  } catch (error) {
    // 401 (key does not own this order / bad key) or 404 (unknown order).
    // Never surface this to the browser as a usable order.
    logger.warn("Stored Razorpay order is unusable with current credentials", {
      bookingId,
      razorpayOrderId: stored.razorpayOrderId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { reuse: false, alreadyPaid: false };
  }

  // The money is already in. Opening checkout again would charge twice; the
  // confirmation path (verifyPayment / razorpayWebhook) owns this transition.
  if (order.status === "paid") {
    logger.payment("anomaly", {
      type: "reused_order_already_paid",
      bookingId,
      razorpayOrderId: stored.razorpayOrderId,
    });
    return { reuse: false, alreadyPaid: true };
  }

  const amountMatches = Number(order.amount) === stored.amountPaise;
  const currencyMatches =
    (order.currency ?? "").toUpperCase() === stored.currency.toUpperCase();

  if (!amountMatches || !currencyMatches) {
    logger.warn("Stored Razorpay order no longer matches the booking", {
      bookingId,
      razorpayOrderId: stored.razorpayOrderId,
      expectedAmount: stored.amountPaise,
      orderAmount: order.amount,
    });
    return { reuse: false, alreadyPaid: false };
  }

  // "created" (untouched) and "attempted" (a previous payment failed) are both
  // payable — retrying a failed payment on the same order is supported.
  return {
    reuse: order.status === "created" || order.status === "attempted",
    alreadyPaid: false,
  };
};

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

  // Fail here, loudly, rather than returning 200 with `keyId: undefined`. An
  // absent key reaches the browser as `key: undefined`, and Razorpay answers the
  // checkout preferences call with 401 — an error that looks like a payment
  // failure to the customer and tells us nothing.
  const creds = getRazorpayCredentials();
  if (!creds) {
    logger.error(
      "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing or empty",
      new Error("Razorpay credentials not configured"),
      { hasKeyId: !!process.env.RAZORPAY_KEY_ID, hasKeySecret: !!process.env.RAZORPAY_KEY_SECRET }
    );
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: "Server configuration error" }),
    };
  }
  const razorpay = makeRazorpay(creds);

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
        amountPaise: true, currency: true, createdAt: true, holdExpiresAt: true,
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

    // The booking still reads PENDING_PAYMENT but its hold has lapsed, so its
    // seats are back in inventory. Opening checkout here would invite a capture
    // against a seat we no longer reserve — verifyPayment would then refuse to
    // confirm and we would owe a refund. Refuse before any money moves.
    if (holdHasExpired(booking)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "This booking has expired. Please start a new booking.",
        }),
      };
    }

    // The hold is live, but it may have only seconds left — a resume-payment
    // link is opened on an already-aging booking. Razorpay's checkout modal
    // stays open for CHECKOUT_TIMEOUT_MS, so unless the hold outlasts that, the
    // booking can expire underneath the open modal and a capture lands on a
    // seat we already released. Push the deadline out before any order exists.
    const holdUntil = await ensureCheckoutWindow(booking);
    if (!holdUntil) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error:
            "We can no longer hold this booking long enough to complete payment. " +
            "Please start a new booking.",
        }),
      };
    }

    // Prevent double-charging: reuse an existing unpaid order if one exists.
    // Reuse is only safe once Razorpay confirms the order is still payable under
    // THESE credentials — see classifyExistingOrder.
    const existingPayment = await prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        status: PaymentStatus.CREATED,
      },
      orderBy: { createdAt: "desc" },
      select: { razorpayOrderId: true, amountPaise: true, currency: true },
    });

    if (existingPayment) {
      const verdict = await classifyExistingOrder(razorpay, existingPayment, booking.id);

      if (!verdict.reuse && verdict.alreadyPaid) {
        // Razorpay has the money but our booking is still PENDING_PAYMENT, so a
        // confirmation was missed. Do not reopen checkout — that double-charges.
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({
            success: false,
            error:
              "This booking has already been paid for. If it is not confirmed within " +
              "a few minutes, please contact us with your booking reference.",
          }),
        };
      }

      if (verdict.reuse) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: {
              orderId: existingPayment.razorpayOrderId,
              keyId: creds.keyId,
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

      // Unusable (wrong account, unknown order, amount drift). Fall through and
      // mint a fresh order under the credentials we are actually serving with.
      // The new Payment row is more recent, so the query above will prefer it.
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
          keyId: creds.keyId,
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
