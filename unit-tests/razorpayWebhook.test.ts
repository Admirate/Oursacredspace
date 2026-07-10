import { HandlerEvent } from "@netlify/functions";
import crypto from "crypto";

jest.mock("../netlify/functions/helpers/prisma", () =>
  require("./__mocks__/prisma")
);

jest.mock("../netlify/functions/helpers/logger", () => ({
  withSentry: (_name: string, fn: any) => fn,
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), payment: jest.fn() },
}));

jest.mock("../netlify/functions/helpers/security", () => ({
  logSecurityEvent: jest.fn(),
}));

jest.mock("../netlify/functions/helpers/notifications", () => ({
  sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
}));

import { handler } from "../netlify/functions/razorpayWebhook";
import { prisma } from "./__mocks__/prisma";
import { sendBookingConfirmation } from "../netlify/functions/helpers/notifications";

const WEBHOOK_SECRET = "whsec_test";
const ORDER_ID = "order_xyz";
const PAYMENT_ID = "pay_xyz";
const BOOKING_ID = "bkg-1";

const sign = (body: string) =>
  crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");

const capturedPayload = () =>
  JSON.stringify({
    event: "payment.captured",
    event_id: "evt_1",
    payload: {
      payment: {
        entity: {
          id: PAYMENT_ID,
          order_id: ORDER_ID,
          status: "captured",
          amount: 50000,
          currency: "INR",
        },
      },
    },
  });

const makeEvent = (body: string, signature?: string): HandlerEvent =>
  ({
    rawUrl: "http://localhost:8888/.netlify/functions/razorpayWebhook",
    rawQuery: "",
    path: "/.netlify/functions/razorpayWebhook",
    httpMethod: "POST",
    headers: { "x-razorpay-signature": signature ?? sign(body) },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body,
    isBase64Encoded: false,
  }) as HandlerEvent;

const setupPayment = (opts: { claimCount: number; confirmCount: number }) => {
  (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
    id: "pmt_1",
    bookingId: BOOKING_ID,
    razorpayOrderId: ORDER_ID,
    status: "CREATED",
    amountPaise: 50000,
    currency: "INR",
    webhookEventId: null,
    razorpayPaymentId: null,
    booking: {
      id: BOOKING_ID,
      status: "PENDING_PAYMENT",
      type: "CLASS",
      customerEmail: "arjun@example.com",
      classSession: null,
      event: null,
    },
  });
  (prisma.payment.updateMany as jest.Mock).mockResolvedValue({ count: opts.claimCount });
  (prisma.booking.updateMany as jest.Mock).mockResolvedValue({ count: opts.confirmCount });
  (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});
  (prisma.$transaction as jest.Mock).mockImplementation((fn: any) => fn(prisma));
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

describe("razorpayWebhook payment.captured", () => {
  it("rejects an invalid signature without processing", async () => {
    setupPayment({ claimCount: 1, confirmCount: 1 });
    const body = capturedPayload();
    const res = await handler(makeEvent(body, "deadbeef"), {} as any);

    expect((res as any).statusCode).toBe(401);
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it("claims the payment with a CREATED-guarded update and confirms", async () => {
    setupPayment({ claimCount: 1, confirmCount: 1 });
    const res = await handler(makeEvent(capturedPayload()), {} as any);

    expect((res as any).statusCode).toBe(200);
    // The claim is conditional on status=CREATED — the property that lets the
    // synchronous verifyPayment path and this webhook not double-confirm.
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pmt_1", status: "CREATED" },
        data: expect.objectContaining({ status: "PAID" }),
      })
    );
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BOOKING_ID, status: "PENDING_PAYMENT" },
        data: { status: "CONFIRMED" },
      })
    );
    expect(sendBookingConfirmation).toHaveBeenCalled();
  });

  it("skips side effects when it loses the claim race (count 0)", async () => {
    // verifyPayment already flipped CREATED->PAID; our claim matches nothing.
    setupPayment({ claimCount: 0, confirmCount: 0 });
    const res = await handler(makeEvent(capturedPayload()), {} as any);

    expect((res as any).statusCode).toBe(200);
    // No duplicate confirmation email, no duplicate statusHistory row.
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(prisma.statusHistory.create).not.toHaveBeenCalled();
    expect(sendBookingConfirmation).not.toHaveBeenCalled();
  });

  it("does not confirm or email when the booking is no longer pending", async () => {
    // Claim won, but the booking expired/cancelled — guarded booking update
    // matches nothing.
    setupPayment({ claimCount: 1, confirmCount: 0 });
    const res = await handler(makeEvent(capturedPayload()), {} as any);

    expect((res as any).statusCode).toBe(200);
    expect(prisma.statusHistory.create).not.toHaveBeenCalled();
    expect(sendBookingConfirmation).not.toHaveBeenCalled();
  });
});
