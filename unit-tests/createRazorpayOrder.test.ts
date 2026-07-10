import { HandlerEvent } from "@netlify/functions";

jest.mock("../netlify/functions/helpers/prisma", () =>
  require("./__mocks__/prisma")
);

jest.mock("../netlify/functions/helpers/logger", () => ({
  withSentry: (_name: string, fn: any) => fn,
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), payment: jest.fn() },
}));

jest.mock("../netlify/functions/helpers/dbRateLimit", () => ({
  isDbRateLimited: jest.fn().mockResolvedValue(false),
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
  RATE_LIMITS: { PAYMENT: { maxRequests: 5, windowMs: 60000 } },
}));

const mockOrdersCreate = jest.fn();
const mockOrdersFetch = jest.fn();
jest.mock("razorpay", () =>
  jest.fn().mockImplementation(() => ({
    orders: { create: mockOrdersCreate, fetch: mockOrdersFetch },
  }))
);

import { handler } from "../netlify/functions/createRazorpayOrder";
import { prisma } from "./__mocks__/prisma";

const ACCESS_TOKEN = "a".repeat(43);

const makeEvent = (body: Record<string, unknown>): HandlerEvent =>
  ({
    rawUrl: "http://localhost:8888/.netlify/functions/createRazorpayOrder",
    rawQuery: "",
    path: "/.netlify/functions/createRazorpayOrder",
    httpMethod: "POST",
    headers: { origin: "http://localhost:3000" },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: JSON.stringify(body),
    isBase64Encoded: false,
  }) as HandlerEvent;

const validBody = { bookingId: "bkg-1", accessToken: ACCESS_TOKEN };

const makeBooking = (overrides: any = {}) => ({
  id: "bkg-1",
  status: "PENDING_PAYMENT",
  type: "CLASS",
  amountPaise: 50000,
  currency: "INR",
  createdAt: new Date(),
  customerName: "Arjun Kumar",
  customerEmail: "arjun@example.com",
  customerPhone: "+919876543210",
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "secret";
  (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);
  mockOrdersCreate.mockResolvedValue({ id: "order_new" });
  // A stored order is reusable only if Razorpay confirms it under the current
  // credentials; default to a healthy, unpaid, amount-matching order.
  mockOrdersFetch.mockResolvedValue({ status: "created", amount: 50000, currency: "INR" });
  (prisma.payment.create as jest.Mock).mockResolvedValue({ id: "pmt_1" });
});

describe("createRazorpayOrder", () => {
  it("creates an order for a booking still inside its hold window", async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue(makeBooking());

    const res = await handler(makeEvent(validBody), {} as any);
    const body = JSON.parse((res as any).body);

    expect((res as any).statusCode).toBe(200);
    expect(body.data.orderId).toBe("order_new");
    expect(mockOrdersCreate).toHaveBeenCalled();
  });

  // The seats are already back in inventory and may have been resold. Letting
  // checkout open here means a capture we cannot honour — verifyPayment would
  // refuse to confirm and we would owe a refund. Refuse before money moves.
  it("refuses to open checkout when the hold has lapsed", async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue(
      makeBooking({ createdAt: new Date(Date.now() - 10 * 60 * 1000) })
    );

    const res = await handler(makeEvent(validBody), {} as any);
    const body = JSON.parse((res as any).body);

    expect((res as any).statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/expired/i);
    expect(mockOrdersCreate).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("rejects a booking that is not awaiting payment", async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue(
      makeBooking({ status: "CONFIRMED" })
    );

    const res = await handler(makeEvent(validBody), {} as any);

    expect((res as any).statusCode).toBe(400);
    expect(mockOrdersCreate).not.toHaveBeenCalled();
  });

  it("returns a generic 404 for a wrong access token", async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await handler(makeEvent(validBody), {} as any);
    const body = JSON.parse((res as any).body);

    expect((res as any).statusCode).toBe(404);
    expect(body.error).toBe("Booking not found");
    expect(mockOrdersCreate).not.toHaveBeenCalled();
  });

  it("reuses an existing unpaid order instead of double-charging", async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue(makeBooking());
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
      razorpayOrderId: "order_existing",
      amountPaise: 50000,
      currency: "INR",
    });

    const res = await handler(makeEvent(validBody), {} as any);
    const body = JSON.parse((res as any).body);

    expect((res as any).statusCode).toBe(200);
    expect(body.data.orderId).toBe("order_existing");
    expect(mockOrdersFetch).toHaveBeenCalledWith("order_existing");
    expect(mockOrdersCreate).not.toHaveBeenCalled();
  });

  it("reuses an order whose previous payment attempt failed", async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue(makeBooking());
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
      razorpayOrderId: "order_existing",
      amountPaise: 50000,
      currency: "INR",
    });
    // Razorpay supports retrying a failed payment on the same order.
    mockOrdersFetch.mockResolvedValue({ status: "attempted", amount: 50000, currency: "INR" });

    const res = await handler(makeEvent(validBody), {} as any);

    expect(JSON.parse((res as any).body).data.orderId).toBe("order_existing");
    expect(mockOrdersCreate).not.toHaveBeenCalled();
  });

  // The regression: an order created under one environment's key, retried by an
  // environment holding a different (or malformed) key. Handing that pair to
  // Checkout makes Razorpay 401 in the browser — "Oops! Something went wrong."
  describe("stored order that does not belong to the current credentials", () => {
    beforeEach(() => {
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(makeBooking());
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        razorpayOrderId: "order_from_another_account",
        amountPaise: 50000,
        currency: "INR",
      });
    });

    it("mints a fresh order when the stored one cannot be fetched", async () => {
      mockOrdersFetch.mockRejectedValue(
        Object.assign(new Error("Unauthorized"), { statusCode: 401 })
      );

      const res = await handler(makeEvent(validBody), {} as any);
      const body = JSON.parse((res as any).body);

      expect((res as any).statusCode).toBe(200);
      // Never hand the browser an order the serving key cannot use.
      expect(body.data.orderId).toBe("order_new");
      expect(body.data.keyId).toBe("rzp_test_key");
      expect(mockOrdersCreate).toHaveBeenCalled();
    });

    it("mints a fresh order when the stored one's amount has drifted", async () => {
      mockOrdersFetch.mockResolvedValue({ status: "created", amount: 999, currency: "INR" });

      const res = await handler(makeEvent(validBody), {} as any);

      expect(JSON.parse((res as any).body).data.orderId).toBe("order_new");
      expect(mockOrdersCreate).toHaveBeenCalled();
    });
  });

  // Reopening checkout on a paid order charges the customer a second time.
  it("refuses to reopen checkout on an order Razorpay already marks paid", async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue(makeBooking());
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
      razorpayOrderId: "order_paid",
      amountPaise: 50000,
      currency: "INR",
    });
    mockOrdersFetch.mockResolvedValue({ status: "paid", amount: 50000, currency: "INR" });

    const res = await handler(makeEvent(validBody), {} as any);
    const body = JSON.parse((res as any).body);

    expect((res as any).statusCode).toBe(409);
    expect(body.error).toMatch(/already been paid/i);
    expect(mockOrdersCreate).not.toHaveBeenCalled();
  });

  // `keyId: undefined` reaches Checkout as `key: undefined`; Razorpay answers
  // its preferences call with 401 and the customer sees "Payment Failed".
  describe("missing Razorpay credentials", () => {
    it.each(["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"])("fails closed when %s is unset", async (v) => {
      delete process.env[v];
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(makeBooking());

      const res = await handler(makeEvent(validBody), {} as any);
      const body = JSON.parse((res as any).body);

      expect((res as any).statusCode).toBe(500);
      expect(body.error).toBe("Server configuration error");
      expect(mockOrdersCreate).not.toHaveBeenCalled();
    });

    it("treats a whitespace-only key as unset rather than shipping it", async () => {
      process.env.RAZORPAY_KEY_ID = "   ";
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(makeBooking());

      expect((await handler(makeEvent(validBody), {} as any) as any).statusCode).toBe(500);
    });

    it("trims a stray-whitespace key rather than sending it to the browser", async () => {
      process.env.RAZORPAY_KEY_ID = "  rzp_test_key\n";
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(makeBooking());

      const res = await handler(makeEvent(validBody), {} as any);

      expect(JSON.parse((res as any).body).data.keyId).toBe("rzp_test_key");
    });
  });

  it("requires an access token", async () => {
    const res = await handler(makeEvent({ bookingId: "bkg-1" }), {} as any);
    expect((res as any).statusCode).toBe(400);
  });
});
