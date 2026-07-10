import { HandlerEvent } from "@netlify/functions";
import crypto from "crypto";

jest.mock("../netlify/functions/helpers/prisma", () =>
  require("./__mocks__/prisma")
);

jest.mock("../netlify/functions/helpers/logger", () => ({
  withSentry: (_name: string, fn: any) => fn,
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    payment: jest.fn(),
  },
}));

jest.mock("../netlify/functions/helpers/dbRateLimit", () => ({
  isDbRateLimited: jest.fn().mockResolvedValue(false),
}));

jest.mock("../netlify/functions/helpers/notifications", () => ({
  sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../netlify/functions/helpers/security", () => ({
  getClientIP: jest.fn().mockReturnValue("127.0.0.1"),
  rateLimitResponse: jest.fn().mockReturnValue({
    statusCode: 429,
    headers: {},
    body: JSON.stringify({ success: false, error: "Too many requests" }),
  }),
  getPublicHeaders: jest.fn().mockReturnValue({ "Content-Type": "application/json" }),
  hashToken: jest.fn((t: string) => `hash:${t}`),
  logSecurityEvent: jest.fn(),
  RATE_LIMITS: {
    PAYMENT: { maxRequests: 5, windowMs: 60000 },
  },
}));

import { handler } from "../netlify/functions/verifyPayment";
import { prisma } from "./__mocks__/prisma";
import { logger } from "../netlify/functions/helpers/logger";
import { sendBookingConfirmation } from "../netlify/functions/helpers/notifications";

const KEY_SECRET = "test_key_secret";
const BOOKING_ID = "bk_abc123";
const ORDER_ID = "order_xyz789";
const PAYMENT_ID = "pay_xyz789";
const ACCESS_TOKEN = "a".repeat(43);

const validSignature = (): string =>
  crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${ORDER_ID}|${PAYMENT_ID}`)
    .digest("hex");

const makeEvent = (body: Record<string, unknown>): HandlerEvent =>
  ({
    rawUrl: "http://localhost:8888/.netlify/functions/verifyPayment",
    rawQuery: "",
    path: "/.netlify/functions/verifyPayment",
    httpMethod: "POST",
    headers: { origin: "http://localhost:3000" },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: JSON.stringify(body),
    isBase64Encoded: false,
  }) as HandlerEvent;

const validBody = () => ({
  bookingId: BOOKING_ID,
  accessToken: ACCESS_TOKEN,
  razorpayOrderId: ORDER_ID,
  razorpayPaymentId: PAYMENT_ID,
  razorpaySignature: validSignature(),
});

/**
 * verifyPayment reads Payment twice: once before the transaction (with an
 * `include` of the booking + relations) and once inside it (with a `select`).
 * Route each call by the shape of the query rather than by call order.
 */
const setupPrisma = (opts: {
  paymentStatusPre: string;
  bookingStatusPre: string;
  paymentStatusTx: string;
  bookingStatusTx: string;
}) => {
  (prisma.booking.findFirst as jest.Mock).mockResolvedValue({
    id: BOOKING_ID,
    status: opts.bookingStatusPre,
    customerEmail: "arjun@example.com",
    customerPhone: "+919876543210",
    type: "CLASS",
  });

  (prisma.payment.findUnique as jest.Mock).mockImplementation((args: any) => {
    if (args.include) {
      return Promise.resolve({
        id: "pmt_1",
        bookingId: BOOKING_ID,
        razorpayOrderId: ORDER_ID,
        status: opts.paymentStatusPre,
        booking: {
          id: BOOKING_ID,
          status: opts.bookingStatusPre,
          type: "CLASS",
          customerEmail: "arjun@example.com",
          classSession: null,
          event: null,
        },
      });
    }
    return Promise.resolve({ id: "pmt_1", status: opts.paymentStatusTx });
  });

  (prisma.booking.findUnique as jest.Mock).mockResolvedValue({
    status: opts.bookingStatusTx,
  });

  // The transaction claims the payment with `updateMany WHERE status=CREATED`
  // (count 1 = we won the CREATED->PAID flip). The unconfirmable handler reuses
  // payment.updateMany with a `razorpayPaymentId: null` guard — route by args.
  (prisma.payment.updateMany as jest.Mock).mockImplementation((args: any) => {
    if (args?.where?.status === "CREATED") {
      return Promise.resolve({ count: opts.paymentStatusTx === "CREATED" ? 1 : 0 });
    }
    return Promise.resolve({ count: 1 }); // reconcile write
  });

  // Booking is confirmed with `updateMany WHERE status=PENDING_PAYMENT`.
  (prisma.booking.updateMany as jest.Mock).mockResolvedValue({
    count: opts.bookingStatusTx === "PENDING_PAYMENT" ? 1 : 0,
  });

  (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});
  (prisma.$transaction as jest.Mock).mockImplementation((fn: any) => fn(prisma));
};

beforeEach(() => {
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
});

describe("verifyPayment", () => {
  it("confirms a pending booking and sends the confirmation email", async () => {
    setupPrisma({
      paymentStatusPre: "CREATED",
      bookingStatusPre: "PENDING_PAYMENT",
      paymentStatusTx: "CREATED",
      bookingStatusTx: "PENDING_PAYMENT",
    });

    const res = await handler(makeEvent(validBody()), {} as any);
    const body = JSON.parse((res as any).body);

    expect((res as any).statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("CONFIRMED");
    expect(body.data.alreadyProcessed).toBe(false);
    // Confirmed via a guarded updateMany (WHERE status=PENDING_PAYMENT), the
    // concurrency-safe path that stops verify and the webhook double-confirming.
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BOOKING_ID, status: "PENDING_PAYMENT" },
        data: { status: "CONFIRMED" },
      })
    );
    expect(sendBookingConfirmation).toHaveBeenCalled();
  });

  it("claims the payment atomically with a CREATED-guarded update", async () => {
    setupPrisma({
      paymentStatusPre: "CREATED",
      bookingStatusPre: "PENDING_PAYMENT",
      paymentStatusTx: "CREATED",
      bookingStatusTx: "PENDING_PAYMENT",
    });

    await handler(makeEvent(validBody()), {} as any);

    // The claim must be conditional on status=CREATED — this is what makes a
    // concurrent webhook get count 0 and skip, instead of both confirming.
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pmt_1", status: "CREATED" },
        data: expect.objectContaining({ status: "PAID" }),
      })
    );
  });

  it("skips side effects when it loses the claim race (count 0)", async () => {
    // Payment already flipped to PAID+CONFIRMED by the webhook before our
    // claim runs: the CREATED-guarded updateMany matches nothing.
    setupPrisma({
      paymentStatusPre: "CREATED",
      bookingStatusPre: "PENDING_PAYMENT",
      paymentStatusTx: "PAID",
      bookingStatusTx: "CONFIRMED",
    });

    const res = await handler(makeEvent(validBody()), {} as any);
    const body = JSON.parse((res as any).body);

    expect((res as any).statusCode).toBe(200);
    expect(body.data.alreadyProcessed).toBe(true);
    // We lost the claim, so we must not confirm or email again.
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(sendBookingConfirmation).not.toHaveBeenCalled();
  });

  it("is idempotent when the webhook already confirmed the booking", async () => {
    setupPrisma({
      paymentStatusPre: "PAID",
      bookingStatusPre: "CONFIRMED",
      paymentStatusTx: "PAID",
      bookingStatusTx: "CONFIRMED",
    });

    const res = await handler(makeEvent(validBody()), {} as any);
    const body = JSON.parse((res as any).body);

    expect((res as any).statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.alreadyProcessed).toBe(true);
    // The webhook already sent it — must not send a second email.
    expect(sendBookingConfirmation).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it("is idempotent when the webhook wins the race mid-transaction", async () => {
    // Pre-transaction read sees CREATED/PENDING; by the time the transaction
    // runs, the webhook has flipped both.
    setupPrisma({
      paymentStatusPre: "CREATED",
      bookingStatusPre: "PENDING_PAYMENT",
      paymentStatusTx: "PAID",
      bookingStatusTx: "CONFIRMED",
    });

    const res = await handler(makeEvent(validBody()), {} as any);
    const body = JSON.parse((res as any).body);

    expect((res as any).statusCode).toBe(200);
    expect(body.data.alreadyProcessed).toBe(true);
    expect(sendBookingConfirmation).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  // The money bug: Razorpay captured the payment while the booking expired.
  it("rejects, does not confirm, and flags a refund when the booking expired", async () => {
    setupPrisma({
      paymentStatusPre: "CREATED",
      bookingStatusPre: "PENDING_PAYMENT",
      paymentStatusTx: "CREATED",
      bookingStatusTx: "EXPIRED",
    });

    const res = await handler(makeEvent(validBody()), {} as any);
    const body = JSON.parse((res as any).body);

    expect((res as any).statusCode).toBe(409);
    expect(body.success).toBe(false);
    // The customer must be given the payment reference for support.
    expect(body.error).toContain(PAYMENT_ID);

    // Nothing may be confirmed, and no "your booking is confirmed" email.
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(sendBookingConfirmation).not.toHaveBeenCalled();

    // The charge must be traceable and alerted on.
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pmt_1", razorpayPaymentId: null },
        data: { razorpayPaymentId: PAYMENT_ID },
      })
    );
    expect(prisma.statusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: expect.stringContaining("REFUND REQUIRED"),
        }),
      })
    );
    expect(logger.payment).toHaveBeenCalledWith(
      "anomaly",
      expect.objectContaining({ type: "captured_payment_unconfirmable_booking" })
    );
  });

  it("rejects and flags a refund when the booking was cancelled", async () => {
    setupPrisma({
      paymentStatusPre: "CREATED",
      bookingStatusPre: "PENDING_PAYMENT",
      paymentStatusTx: "CREATED",
      bookingStatusTx: "CANCELLED",
    });

    const res = await handler(makeEvent(validBody()), {} as any);

    expect((res as any).statusCode).toBe(409);
    expect(sendBookingConfirmation).not.toHaveBeenCalled();
    expect(logger.payment).toHaveBeenCalledWith("anomaly", expect.anything());
  });

  it("rejects and flags a refund when the payment row already FAILED", async () => {
    setupPrisma({
      paymentStatusPre: "CREATED",
      bookingStatusPre: "PENDING_PAYMENT",
      paymentStatusTx: "FAILED",
      bookingStatusTx: "PENDING_PAYMENT",
    });

    const res = await handler(makeEvent(validBody()), {} as any);

    expect((res as any).statusCode).toBe(409);
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(sendBookingConfirmation).not.toHaveBeenCalled();
  });

  it("rejects a forged signature before touching the booking", async () => {
    setupPrisma({
      paymentStatusPre: "CREATED",
      bookingStatusPre: "PENDING_PAYMENT",
      paymentStatusTx: "CREATED",
      bookingStatusTx: "PENDING_PAYMENT",
    });

    const res = await handler(
      makeEvent({ ...validBody(), razorpaySignature: "f".repeat(64) }),
      {} as any
    );

    expect((res as any).statusCode).toBe(401);
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });
});
