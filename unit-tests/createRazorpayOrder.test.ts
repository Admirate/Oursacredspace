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
jest.mock("razorpay", () =>
  jest.fn().mockImplementation(() => ({ orders: { create: mockOrdersCreate } }))
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
    expect(mockOrdersCreate).not.toHaveBeenCalled();
  });

  it("requires an access token", async () => {
    const res = await handler(makeEvent({ bookingId: "bkg-1" }), {} as any);
    expect((res as any).statusCode).toBe(400);
  });
});
