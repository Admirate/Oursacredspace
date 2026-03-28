import { HandlerEvent } from "@netlify/functions";

jest.mock("../netlify/functions/helpers/prisma", () =>
  require("./__mocks__/prisma")
);

jest.mock("../netlify/functions/helpers/logger", () => ({
  withSentry: (_name: string, fn: any) => fn,
}));

jest.mock("../netlify/functions/helpers/security", () => ({
  getClientIP: jest.fn().mockReturnValue("127.0.0.1"),
  isRateLimited: jest.fn().mockReturnValue(false),
  rateLimitResponse: jest.fn().mockReturnValue({
    statusCode: 429,
    headers: {},
    body: JSON.stringify({ success: false, error: "Too many requests" }),
  }),
  getPublicHeaders: jest.fn().mockReturnValue({ "Content-Type": "application/json" }),
  RATE_LIMITS: {
    BOOKING_CREATE: { maxRequests: 10, windowMs: 60000 },
  },
}));

import { handler } from "../netlify/functions/createBooking";
import { prisma } from "./__mocks__/prisma";
import { isRateLimited } from "../netlify/functions/helpers/security";

const makeEvent = (overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/createBooking",
  rawQuery: "",
  path: "/.netlify/functions/createBooking",
  httpMethod: "POST",
  headers: { origin: "http://localhost:3000" },
  multiValueHeaders: {},
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  body: null,
  isBase64Encoded: false,
  ...overrides,
});

const validClassBody = {
  type: "CLASS",
  name: "Arjun Kumar",
  phone: "9876543210",
  email: "arjun@example.com",
  classSessionId: "cls-abc123",
};

const validEventBody = {
  type: "EVENT",
  name: "Priya Singh",
  phone: "9876543211",
  email: "priya@example.com",
  eventId: "evt-abc123",
};

const validSpaceBody = {
  type: "SPACE",
  name: "Rahul Verma",
  phone: "9876543212",
  email: "rahul@example.com",
  preferredSlots: ["Morning 9-11am", "Evening 6-8pm"],
  purpose: "Photography workshop",
};

const makeClass = (overrides: any = {}) => ({
  id: "cls-abc123",
  title: "Yoga for Beginners",
  active: true,
  capacity: 20,
  pricePaise: 50000,
  ...overrides,
});

const makeEvent_ = (overrides: any = {}) => ({
  id: "evt-abc123",
  title: "Open Mic Night",
  active: true,
  capacity: 50,
  pricePaise: 20000,
  ...overrides,
});

const makeBooking = (overrides: any = {}) => ({
  id: "bkg-new-001",
  type: "CLASS",
  status: "PENDING_PAYMENT",
  customerName: "Arjun Kumar",
  customerPhone: "+919876543210",
  customerEmail: "arjun@example.com",
  amountPaise: 50000,
  currency: "INR",
  ...overrides,
});

describe("createBooking handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation((fn: any) => fn(prisma));
  });

  // ── HTTP guards ──

  it("returns 204 for OPTIONS preflight", async () => {
    const response = await handler(makeEvent({ httpMethod: "OPTIONS" }), {} as any);
    expect(response!.statusCode).toBe(204);
  });

  it("returns 405 for GET", async () => {
    const response = await handler(makeEvent({ httpMethod: "GET" }), {} as any);
    expect(response!.statusCode).toBe(405);
  });

  it("returns 405 for DELETE", async () => {
    const response = await handler(makeEvent({ httpMethod: "DELETE" }), {} as any);
    expect(response!.statusCode).toBe(405);
  });

  // ── Rate limiting ──

  it("returns 429 when rate limited", async () => {
    (isRateLimited as jest.Mock).mockReturnValueOnce(true);
    const response = await handler(
      makeEvent({ body: JSON.stringify(validClassBody) }),
      {} as any
    );
    expect(response!.statusCode).toBe(429);
  });

  // ── Validation ──

  it("returns 400 for empty body", async () => {
    const response = await handler(makeEvent({ body: "" }), {} as any);
    expect(response!.statusCode).toBe(400);
    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(false);
  });

  it("returns 400 for invalid email", async () => {
    const response = await handler(
      makeEvent({ body: JSON.stringify({ ...validClassBody, email: "not-an-email" }) }),
      {} as any
    );
    expect(response!.statusCode).toBe(400);
  });

  it("returns 400 for name too short", async () => {
    const response = await handler(
      makeEvent({ body: JSON.stringify({ ...validClassBody, name: "A" }) }),
      {} as any
    );
    expect(response!.statusCode).toBe(400);
  });

  it("returns 400 for invalid phone number", async () => {
    const response = await handler(
      makeEvent({ body: JSON.stringify({ ...validClassBody, phone: "12345" }) }),
      {} as any
    );
    expect(response!.statusCode).toBe(400);
  });

  it("returns 400 for invalid booking type", async () => {
    const response = await handler(
      makeEvent({ body: JSON.stringify({ ...validClassBody, type: "INVALID" }) }),
      {} as any
    );
    expect(response!.statusCode).toBe(400);
  });

  // ── CLASS booking ──

  it("returns 400 when classSessionId is missing for CLASS booking", async () => {
    const { classSessionId: _, ...noId } = validClassBody;
    const response = await handler(
      makeEvent({ body: JSON.stringify(noId) }),
      {} as any
    );
    expect(response!.statusCode).toBe(400);
    const body = JSON.parse(response!.body!);
    expect(body.error).toBe("classSessionId is required for CLASS booking");
  });

  it("returns 404 when class session is not found", async () => {
    (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(null);
    const response = await handler(
      makeEvent({ body: JSON.stringify(validClassBody) }),
      {} as any
    );
    expect(response!.statusCode).toBe(404);
    const body = JSON.parse(response!.body!);
    expect(body.error).toBe("Class session not found");
  });

  it("returns 400 when class is inactive", async () => {
    (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass({ active: false }));
    const response = await handler(
      makeEvent({ body: JSON.stringify(validClassBody) }),
      {} as any
    );
    expect(response!.statusCode).toBe(400);
    const body = JSON.parse(response!.body!);
    expect(body.error).toBe("This class is no longer available");
  });

  it("returns 400 when class is fully booked", async () => {
    (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass({ capacity: 10 }));
    (prisma.booking.count as jest.Mock).mockResolvedValue(10);
    const response = await handler(
      makeEvent({ body: JSON.stringify(validClassBody) }),
      {} as any
    );
    expect(response!.statusCode).toBe(400);
    const body = JSON.parse(response!.body!);
    expect(body.error).toBe("This class is fully booked");
  });

  it("returns 200 for valid CLASS booking", async () => {
    (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
    (prisma.booking.count as jest.Mock).mockResolvedValue(5);
    (prisma.booking.create as jest.Mock).mockResolvedValue(makeBooking());
    (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});

    const response = await handler(
      makeEvent({ body: JSON.stringify(validClassBody) }),
      {} as any
    );

    expect(response!.statusCode).toBe(200);
    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(true);
    expect(body.data.bookingId).toBe("bkg-new-001");
    expect(body.data.requiresPayment).toBe(true);
  });

  it("allows booking when class has unlimited capacity (null)", async () => {
    (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass({ capacity: null }));
    (prisma.booking.create as jest.Mock).mockResolvedValue(makeBooking());
    (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});

    const response = await handler(
      makeEvent({ body: JSON.stringify(validClassBody) }),
      {} as any
    );

    expect(response!.statusCode).toBe(200);
    expect(prisma.booking.count).not.toHaveBeenCalled();
  });

  // ── EVENT booking ──

  it("returns 400 when eventId is missing for EVENT booking", async () => {
    const { eventId: _, ...noId } = validEventBody;
    const response = await handler(
      makeEvent({ body: JSON.stringify(noId) }),
      {} as any
    );
    expect(response!.statusCode).toBe(400);
    const body = JSON.parse(response!.body!);
    expect(body.error).toBe("eventId is required for EVENT booking");
  });

  it("returns 404 when event is not found", async () => {
    (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);
    const response = await handler(
      makeEvent({ body: JSON.stringify(validEventBody) }),
      {} as any
    );
    expect(response!.statusCode).toBe(404);
    const body = JSON.parse(response!.body!);
    expect(body.error).toBe("Event not found");
  });

  it("returns 400 when event is inactive", async () => {
    (prisma.event.findUnique as jest.Mock).mockResolvedValue(makeEvent_({ active: false }));
    const response = await handler(
      makeEvent({ body: JSON.stringify(validEventBody) }),
      {} as any
    );
    expect(response!.statusCode).toBe(400);
    const body = JSON.parse(response!.body!);
    expect(body.error).toBe("This event is no longer available");
  });

  it("returns 400 when event is fully booked", async () => {
    (prisma.event.findUnique as jest.Mock).mockResolvedValue(makeEvent_({ capacity: 50 }));
    (prisma.booking.count as jest.Mock).mockResolvedValue(50);
    const response = await handler(
      makeEvent({ body: JSON.stringify(validEventBody) }),
      {} as any
    );
    expect(response!.statusCode).toBe(400);
    const body = JSON.parse(response!.body!);
    expect(body.error).toBe("This event is fully booked");
  });

  it("returns 200 for valid EVENT booking", async () => {
    (prisma.event.findUnique as jest.Mock).mockResolvedValue(makeEvent_());
    (prisma.booking.count as jest.Mock).mockResolvedValue(10);
    (prisma.booking.create as jest.Mock).mockResolvedValue(makeBooking({ type: "EVENT" }));
    (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});

    const response = await handler(
      makeEvent({ body: JSON.stringify(validEventBody) }),
      {} as any
    );

    expect(response!.statusCode).toBe(200);
    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(true);
    expect(body.data.requiresPayment).toBe(true);
  });

  // ── SPACE booking ──

  it("returns 400 when preferredSlots is missing for SPACE booking", async () => {
    const { preferredSlots: _, ...noSlots } = validSpaceBody;
    const response = await handler(
      makeEvent({ body: JSON.stringify(noSlots) }),
      {} as any
    );
    expect(response!.statusCode).toBe(400);
    const body = JSON.parse(response!.body!);
    expect(body.error).toBe("preferredSlots is required for SPACE booking");
  });

  it("returns 200 for valid SPACE booking with requiresPayment false", async () => {
    (prisma.spaceRequest.create as jest.Mock).mockResolvedValue({ id: "spr-001" });
    (prisma.booking.create as jest.Mock).mockResolvedValue(
      makeBooking({ type: "SPACE", status: "REQUESTED", amountPaise: 0 })
    );
    (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});

    const response = await handler(
      makeEvent({ body: JSON.stringify(validSpaceBody) }),
      {} as any
    );

    expect(response!.statusCode).toBe(200);
    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(true);
    expect(body.data.requiresPayment).toBe(false);
  });

  // ── Transaction race-condition errors ──

  it("returns 400 with CLASS_FULL when transaction throws CLASS_FULL", async () => {
    (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
    (prisma.booking.count as jest.Mock).mockResolvedValue(5);
    (prisma.$transaction as jest.Mock).mockRejectedValue(new Error("CLASS_FULL"));

    const response = await handler(
      makeEvent({ body: JSON.stringify(validClassBody) }),
      {} as any
    );

    expect(response!.statusCode).toBe(400);
    const body = JSON.parse(response!.body!);
    expect(body.error).toBe("This class is fully booked");
  });

  it("returns 400 with EVENT_FULL when transaction throws EVENT_FULL", async () => {
    (prisma.event.findUnique as jest.Mock).mockResolvedValue(makeEvent_());
    (prisma.booking.count as jest.Mock).mockResolvedValue(10);
    (prisma.$transaction as jest.Mock).mockRejectedValue(new Error("EVENT_FULL"));

    const response = await handler(
      makeEvent({ body: JSON.stringify(validEventBody) }),
      {} as any
    );

    expect(response!.statusCode).toBe(400);
    const body = JSON.parse(response!.body!);
    expect(body.error).toBe("This event is fully booked");
  });

  // ── DB error ──

  it("returns 500 on unexpected database error", async () => {
    (prisma.classSession.findUnique as jest.Mock).mockRejectedValue(new Error("DB crashed"));

    const response = await handler(
      makeEvent({ body: JSON.stringify(validClassBody) }),
      {} as any
    );

    expect(response!.statusCode).toBe(500);
    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Failed to create booking. Please try again.");
  });

  // ── statusHistory ──

  it("creates a statusHistory record on successful booking", async () => {
    (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
    (prisma.booking.count as jest.Mock).mockResolvedValue(0);
    (prisma.booking.create as jest.Mock).mockResolvedValue(makeBooking());
    (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});

    await handler(makeEvent({ body: JSON.stringify(validClassBody) }), {} as any);

    expect(prisma.statusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: "NONE",
          changedBy: "SYSTEM",
          reason: "Booking created",
        }),
      })
    );
  });
});
