import { HandlerEvent } from "@netlify/functions";

jest.mock("../netlify/functions/helpers/prisma", () =>
  require("./__mocks__/prisma")
);

jest.mock("../netlify/functions/helpers/logger", () => ({
  withSentry: (_name: string, fn: any) => fn,
  // bookingHold's expireStaleHolds logs via `logger`; without this the helper's
  // own catch block throws on `logger.error` and every handler returns 500.
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    payment: jest.fn(),
  },
}));

// createBooking rate-limits via the DB-backed limiter (isDbRateLimited), not
// the in-memory isRateLimited. Mock it directly so tests control the outcome
// without exercising the real $transaction/rateLimitEntry path.
jest.mock("../netlify/functions/helpers/dbRateLimit", () => ({
  isDbRateLimited: jest.fn().mockResolvedValue(false),
}));

// SEC-004: the resume path emails a link instead of returning a token.
jest.mock("../netlify/functions/helpers/notifications", () => ({
  sendResumePaymentLink: jest.fn().mockResolvedValue({ ok: true }),
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
  // SECURITY (SEC-005/006): createBooking now hashes a per-booking access
  // token using hashToken; tests need a deterministic stand-in.
  hashToken: jest.fn((t: string) => `hash:${t}`),
  RATE_LIMITS: {
    BOOKING_CREATE: { maxRequests: 10, windowMs: 60000 },
  },
}));

import { handler } from "../netlify/functions/createBooking";
import { prisma } from "./__mocks__/prisma";
import { isDbRateLimited } from "../netlify/functions/helpers/dbRateLimit";
import { sendResumePaymentLink } from "../netlify/functions/helpers/notifications";

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

/**
 * Capacity is enforced against the SUM of `quantity` across active bookings
 * (booking.aggregate), not a row count — one booking may hold several seats.
 * The handler calls aggregate twice: once up front, and again inside the
 * transaction to re-check under concurrency. A single mockResolvedValue
 * answers both reads.
 */
const stubBookedSeats = (seats: number) => {
  (prisma.booking.aggregate as jest.Mock).mockResolvedValue({
    _sum: { quantity: seats },
  });
};

describe("createBooking handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation((fn: any) => fn(prisma));
    // clearAllMocks clears call records but NOT mockResolvedValue
    // implementations. Reset the duplicate-check default each test so a
    // truthy value set by the duplicate test does not leak into later tests.
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue(null);
    stubBookedSeats(0);
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
    (isDbRateLimited as jest.Mock).mockResolvedValueOnce(true);
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
    stubBookedSeats(10);
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
    stubBookedSeats(5);
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
    // SEC-005/006: response must include a per-booking access token so the
    // client can fetch the booking and create a payment order.
    expect(typeof body.data.accessToken).toBe("string");
    expect(body.data.accessToken.length).toBeGreaterThanOrEqual(40);
  });

  // SEC-004: Duplicate-check must not leak an existing bookingId. A booking
  // that is already CONFIRMED has nothing to resume, so it must return a 409
  // with a generic message. The check also requires phone to match before
  // treating a request as a duplicate.
  it("returns 409 without leaking bookingId when a confirmed duplicate exists", async () => {
    (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
    stubBookedSeats(0);
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue({
      id: "bkg-existing-001",
      status: "CONFIRMED",
      type: "CLASS",
      amountPaise: 50000,
    });

    const response = await handler(
      makeEvent({ body: JSON.stringify(validClassBody) }),
      {} as any
    );

    expect(response!.statusCode).toBe(409);
    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/already have a confirmed booking/i);
    expect(JSON.stringify(body)).not.toContain("bkg-existing-001");
    // The duplicate query must match on the full attendee identity: email,
    // phone AND name. Any two of them are not enough.
    const findFirstCall = (prisma.booking.findFirst as jest.Mock).mock.calls[0][0];
    expect(findFirstCall.where).toEqual(
      expect.objectContaining({
        customerEmail: "arjun@example.com",
        customerPhone: "+919876543210",
        customerName: { equals: "Arjun Kumar", mode: "insensitive" },
      })
    );
    // Neither an access token nor a booking id may be minted for a duplicate.
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  // A household books several attendees from one email + phone (a parent
  // booking for two children). Keying identity on email+phone alone made the
  // second attendee look like a duplicate of the first and blocked them with
  // "You already have a confirmed booking for this."
  describe("attendee identity includes the name", () => {
    it("lets a different name book with the same email and phone", async () => {
      (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
      stubBookedSeats(0);
      (prisma.booking.create as jest.Mock).mockResolvedValue(makeBooking());
      (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});
      // No row matches, because the duplicate probe is scoped to this name.
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await handler(
        makeEvent({
          body: JSON.stringify({ ...validClassBody, name: "Priya Kumar" }),
        }),
        {} as any
      );

      expect(response!.statusCode).toBe(200);
      const where = (prisma.booking.findFirst as jest.Mock).mock.calls[0][0].where;
      expect(where.customerName).toEqual({ equals: "Priya Kumar", mode: "insensitive" });
      // Same contact details — those alone must not block the booking.
      expect(where.customerEmail).toBe("arjun@example.com");
      expect(where.customerPhone).toBe("+919876543210");
      expect(prisma.booking.create).toHaveBeenCalled();
    });

    // A double-click must still collapse, so casing/spacing cannot be a way to
    // slip a second identical booking through.
    it("still treats the same name in different casing as a duplicate", async () => {
      (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
      stubBookedSeats(0);
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue({
        id: "bkg-existing-001",
        status: "CONFIRMED",
        type: "CLASS",
        amountPaise: 50000,
      });

      const response = await handler(
        makeEvent({ body: JSON.stringify({ ...validClassBody, name: "arjun kumar" }) }),
        {} as any
      );

      expect(response!.statusCode).toBe(409);
      // Case-insensitive match is delegated to Postgres, not to a lowercased
      // copy of the name, so the stored value keeps its original casing.
      const where = (prisma.booking.findFirst as jest.Mock).mock.calls[0][0].where;
      expect(where.customerName).toEqual({ equals: "arjun kumar", mode: "insensitive" });
    });

    it("collapses internal whitespace so spacing cannot fork an attendee", async () => {
      (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
      stubBookedSeats(0);
      (prisma.booking.create as jest.Mock).mockResolvedValue(makeBooking());
      (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(null);

      await handler(
        makeEvent({ body: JSON.stringify({ ...validClassBody, name: "  Arjun   Kumar  " }) }),
        {} as any
      );

      const where = (prisma.booking.findFirst as jest.Mock).mock.calls[0][0].where;
      expect(where.customerName).toEqual({ equals: "Arjun Kumar", mode: "insensitive" });
      // The normalised name is what gets stored, too.
      expect((prisma.booking.create as jest.Mock).mock.calls[0][0].data.customerName).toBe(
        "Arjun Kumar"
      );
    });

    it("scopes the SPACE duplicate probe to the attendee name as well", async () => {
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.spaceRequest.create as jest.Mock).mockResolvedValue({ id: "spc-1" });
      (prisma.booking.create as jest.Mock).mockResolvedValue(makeBooking({ type: "SPACE" }));
      (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});

      await handler(makeEvent({ body: JSON.stringify(validSpaceBody) }), {} as any);

      const where = (prisma.booking.findFirst as jest.Mock).mock.calls[0][0].where;
      expect(where.customerName).toEqual({
        equals: validSpaceBody.name,
        mode: "insensitive",
      });
    });
  });

  it("allows booking when class has unlimited capacity (null)", async () => {
    (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass({ capacity: null }));
    stubBookedSeats(0);
    (prisma.booking.create as jest.Mock).mockResolvedValue(makeBooking());
    (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});

    const response = await handler(
      makeEvent({ body: JSON.stringify(validClassBody) }),
      {} as any
    );

    // A null capacity means unlimited: the booking is created regardless of
    // the current booked count (the count is queried but not used as a cap).
    expect(response!.statusCode).toBe(200);
    expect(prisma.booking.create).toHaveBeenCalled();
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
    stubBookedSeats(50);
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
    stubBookedSeats(10);
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

  it("creates the SpaceRequest inside the booking transaction (not before)", async () => {
    (prisma.spaceRequest.create as jest.Mock).mockResolvedValue({ id: "spr-002" });
    (prisma.booking.create as jest.Mock).mockResolvedValue(
      makeBooking({ type: "SPACE", status: "REQUESTED", amountPaise: 0 })
    );
    (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});

    await handler(makeEvent({ body: JSON.stringify(validSpaceBody) }), {} as any);

    // The SpaceRequest and the Booking must be created within the same
    // transaction so a failure cannot orphan the SpaceRequest (F6).
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.spaceRequest.create).toHaveBeenCalledTimes(1);
    const bookingArgs = (prisma.booking.create as jest.Mock).mock.calls[0][0];
    expect(bookingArgs.data.spaceRequestId).toBe("spr-002");
  });

  // F6: a duplicate SPACE request must be rejected WITHOUT ever creating an
  // orphaned SpaceRequest row.
  it("returns 409 for a duplicate SPACE request and does not create a SpaceRequest", async () => {
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue({ id: "bkg-existing-space" });

    const response = await handler(
      makeEvent({ body: JSON.stringify(validSpaceBody) }),
      {} as any
    );

    expect(response!.statusCode).toBe(409);
    expect(prisma.spaceRequest.create).not.toHaveBeenCalled();
    // The dedup query must target open (REQUESTED) SPACE bookings for this person.
    const findFirstCall = (prisma.booking.findFirst as jest.Mock).mock.calls[0][0];
    expect(findFirstCall.where).toEqual(
      expect.objectContaining({
        customerEmail: "rahul@example.com",
        customerPhone: "+919876543212",
        type: "SPACE",
        status: "REQUESTED",
      })
    );
  });

  // ── Transaction race-condition errors ──

  it("returns 400 with CLASS_FULL when transaction throws CLASS_FULL", async () => {
    (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
    stubBookedSeats(5);
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
    stubBookedSeats(10);
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
    stubBookedSeats(0);
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

  // ── Unpaid-booking hold window (denial-of-inventory) ──

  describe("seat hold window", () => {
    // The unpaid clause keyed on the row's stored deadline (the normal case).
    const pendingClause = (call: any) =>
      call.where.OR?.find((c: any) => c.status === "PENDING_PAYMENT" && c.holdExpiresAt?.gt);

    // Writes that rotate the per-booking access token, as opposed to the
    // hold-extension / stale-sweep writes that also go through updateMany.
    const tokenRotations = () =>
      (prisma.booking.updateMany as jest.Mock).mock.calls.filter(
        ([arg]: any[]) => arg?.data?.accessTokenHash
      );

    beforeEach(() => {
      // Hold extension claims the row with `updateMany ... WHERE PENDING_PAYMENT`
      // and requires count 1; the shared mock defaults to 0 (no match).
      (prisma.booking.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    });

    it("excludes hold-expired unpaid bookings from the capacity count", async () => {
      (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
      (prisma.booking.create as jest.Mock).mockResolvedValue(makeBooking());
      (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});

      await handler(makeEvent({ body: JSON.stringify(validClassBody) }), {} as any);

      // Without this bound, abandoned bookings would hold seats forever and an
      // attacker could exhaust a class's capacity for free.
      const aggCall = (prisma.booking.aggregate as jest.Mock).mock.calls[0][0];
      const pending = pendingClause(aggCall);
      expect(pending).toBeDefined();
      // Compared against NOW, so an extended hold still counts and a lapsed one
      // does not — regardless of how old the booking is.
      expect(pending.holdExpiresAt.gt).toBeInstanceOf(Date);
      expect(aggCall.where.OR).toContainEqual({ status: "CONFIRMED" });
    });

    it("row-locks the class inside the transaction before the capacity re-check", async () => {
      (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
      (prisma.booking.create as jest.Mock).mockResolvedValue(makeBooking());
      (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});

      // Record the order of the lock ($queryRaw FOR UPDATE) and the in-tx
      // aggregate. The lock MUST come first, or two racing bookings both read a
      // stale count and overbook the last seat.
      const order: string[] = [];
      (prisma.$queryRaw as jest.Mock).mockImplementation((strings: any) => {
        if (String(strings?.join?.("")).includes("FOR UPDATE")) order.push("lock");
        return Promise.resolve([]);
      });
      // Aggregate is called both pre-tx and in-tx; tag every call, we only need
      // to see a lock precede the last (in-tx) one.
      (prisma.booking.aggregate as jest.Mock).mockImplementation(() => {
        order.push("aggregate");
        return Promise.resolve({ _sum: { quantity: 0 } });
      });

      await handler(makeEvent({ body: JSON.stringify(validClassBody) }), {} as any);

      expect(order).toContain("lock");
      // The lock precedes the final (transactional) aggregate.
      expect(order.indexOf("lock")).toBeLessThan(order.lastIndexOf("aggregate"));
    });

    it("sweeps stale holds for the class before counting seats", async () => {
      (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
      (prisma.booking.findMany as jest.Mock).mockResolvedValue([{ id: "bkg-stale" }]);
      (prisma.booking.create as jest.Mock).mockResolvedValue(makeBooking());
      (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});

      await handler(makeEvent({ body: JSON.stringify(validClassBody) }), {} as any);

      expect(prisma.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "EXPIRED" }),
        })
      );
    });

    it("still creates the booking when the stale-hold sweep fails", async () => {
      (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
      // The read-time filter already protects capacity, so a sweep failure
      // must not fail the customer's booking.
      (prisma.booking.findMany as jest.Mock).mockRejectedValue(new Error("DB down"));
      (prisma.booking.create as jest.Mock).mockResolvedValue(makeBooking());
      (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});

      const response = await handler(
        makeEvent({ body: JSON.stringify(validClassBody) }),
        {} as any
      );

      expect(response!.statusCode).toBe(200);
    });

    // SEC-004: the resume path must NOT return the bookingId or a token in the
    // response body — both are the PII-disclosure vector. It emails the link to
    // the booking's own address instead.
    it("emails the resume link and leaks neither bookingId nor token", async () => {
      (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue({
        id: "bkg-existing-001",
        status: "PENDING_PAYMENT",
        type: "CLASS",
        amountPaise: 50000,
        createdAt: new Date(Date.now() - 4 * 60 * 1000), // aging, but hold still live
        holdExpiresAt: new Date(Date.now() + 60 * 1000),
        customerName: "Arjun Kumar",
        customerEmail: "arjun@example.com",
      });

      const response = await handler(
        makeEvent({ body: JSON.stringify(validClassBody) }),
        {} as any
      );

      expect(response!.statusCode).toBe(200);
      const raw = response!.body!;
      const body = JSON.parse(raw);

      expect(body.data.resumeEmailSent).toBe(true);
      // The response must be free of anything that unlocks the booking.
      expect(body.data.bookingId).toBeUndefined();
      expect(body.data.accessToken).toBeUndefined();
      expect(raw).not.toContain("bkg-existing-001");

      // The link was emailed to the booking's own address, not the caller.
      expect(sendResumePaymentLink).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "bkg-existing-001",
          customerEmail: "arjun@example.com",
        }),
        expect.stringContaining("/success?bookingId=bkg-existing-001&token=")
      );
    });

    // The bug this whole change exists to fix: the hold was measured from
    // createdAt, so a link emailed against an aging booking was dead (or
    // expiring) by the time it was delivered, read and clicked.
    it("extends the seat hold before emailing the resume link", async () => {
      (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue({
        id: "bkg-existing-001",
        status: "PENDING_PAYMENT",
        type: "CLASS",
        amountPaise: 50000,
        createdAt: new Date(Date.now() - 4 * 60 * 1000),
        holdExpiresAt: new Date(Date.now() + 60 * 1000), // ~1 min left
        customerName: "Arjun Kumar",
        customerEmail: "arjun@example.com",
      });

      await handler(makeEvent({ body: JSON.stringify(validClassBody) }), {} as any);

      const extension = (prisma.booking.updateMany as jest.Mock).mock.calls.find(
        ([arg]: any[]) => arg?.data?.holdExpiresAt
      );
      expect(extension).toBeDefined();
      const [arg] = extension!;
      expect(arg.where).toMatchObject({ id: "bkg-existing-001", status: "PENDING_PAYMENT" });
      // Pushed well past the original 5-minute window the old link raced.
      expect(arg.data.holdExpiresAt.getTime()).toBeGreaterThan(Date.now() + 5 * 60 * 1000);
    });

    // If the booking is confirmed/expired between the read and the extension,
    // the guarded update matches nothing and we must not email a dead link.
    it("refuses to resume when the hold can no longer be claimed", async () => {
      (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue({
        id: "bkg-existing-001",
        status: "PENDING_PAYMENT",
        type: "CLASS",
        amountPaise: 50000,
        createdAt: new Date(),
        holdExpiresAt: new Date(Date.now() + 60 * 1000),
        customerName: "Arjun Kumar",
        customerEmail: "arjun@example.com",
      });
      (prisma.booking.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const response = await handler(
        makeEvent({ body: JSON.stringify(validClassBody) }),
        {} as any
      );

      expect(response!.statusCode).toBe(409);
      expect(sendResumePaymentLink).not.toHaveBeenCalled();
      expect(response!.body!).not.toContain("bkg-existing-001");
    });

    it("rotates the token only after the email is accepted for delivery", async () => {
      (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue({
        id: "bkg-existing-001",
        status: "PENDING_PAYMENT",
        type: "CLASS",
        amountPaise: 50000,
        createdAt: new Date(),
        holdExpiresAt: new Date(Date.now() + 60 * 1000),
        customerName: "Arjun Kumar",
        customerEmail: "arjun@example.com",
      });

      // Email delivery fails — the token must NOT be rotated, or we would break
      // the customer's existing link without delivering a replacement.
      (sendResumePaymentLink as jest.Mock).mockResolvedValueOnce({ ok: false, reason: "down" });

      const response = await handler(
        makeEvent({ body: JSON.stringify(validClassBody) }),
        {} as any
      );

      // Still generic — the failure must not be distinguishable by the caller.
      const body = JSON.parse(response!.body!);
      expect(body.data.resumeEmailSent).toBe(true);
      expect(tokenRotations()).toHaveLength(0);
    });

    it("does not email or rotate when resume attempts are rate limited", async () => {
      (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue({
        id: "bkg-existing-001",
        status: "PENDING_PAYMENT",
        type: "CLASS",
        amountPaise: 50000,
        createdAt: new Date(),
        customerName: "Arjun Kumar",
        customerEmail: "arjun@example.com",
      });

      // First call = booking rate-limit gate (allow), second = resume gate (block).
      (isDbRateLimited as jest.Mock)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const response = await handler(
        makeEvent({ body: JSON.stringify(validClassBody) }),
        {} as any
      );

      const body = JSON.parse(response!.body!);
      // Same generic body, but no email bomb and no token rotation.
      expect(body.data.resumeEmailSent).toBe(true);
      expect(sendResumePaymentLink).not.toHaveBeenCalled();
      expect(tokenRotations()).toHaveLength(0);
    });

    // Belt and braces: if the sweep failed, a stale row can still surface here.
    // Its seats are already back in inventory, so issuing a fresh token would
    // let the customer pay for a seat we may have resold.
    it("refuses to resume an unpaid booking whose hold has lapsed", async () => {
      (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue({
        id: "bkg-existing-001",
        status: "PENDING_PAYMENT",
        type: "CLASS",
        amountPaise: 50000,
        createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min old
        holdExpiresAt: new Date(Date.now() - 5 * 60 * 1000), // lapsed 5 min ago
      });

      const response = await handler(
        makeEvent({ body: JSON.stringify(validClassBody) }),
        {} as any
      );

      expect(response!.statusCode).toBe(409);
      const body = JSON.parse(response!.body!);
      expect(body.error).toMatch(/expired before payment/i);
      // No fresh access token may be minted for a dead hold, and the lapsed hold
      // must not be revived — its seat is back in inventory and may be resold.
      expect(tokenRotations()).toHaveLength(0);
      expect(prisma.booking.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ holdExpiresAt: expect.anything() }) })
      );
      expect(JSON.stringify(body)).not.toContain("bkg-existing-001");
    });

    it("does not let an expired attempt permanently block a rebooking", async () => {
      (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
      (prisma.booking.create as jest.Mock).mockResolvedValue(makeBooking());
      (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});

      await handler(makeEvent({ body: JSON.stringify(validClassBody) }), {} as any);

      // The duplicate probe must ignore hold-expired rows, otherwise a customer
      // who abandoned a checkout could never book that class again.
      const dupCall = (prisma.booking.findFirst as jest.Mock).mock.calls[0][0];
      const pending = pendingClause(dupCall);
      expect(pending).toBeDefined();
      expect(pending.holdExpiresAt.gt).toBeInstanceOf(Date);
    });

    // A fresh booking must start its hold immediately; otherwise the row would
    // never occupy a seat and capacity could be oversold.
    it("stamps a hold deadline on a new paid booking", async () => {
      (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(makeClass());
      (prisma.booking.create as jest.Mock).mockResolvedValue(makeBooking());
      (prisma.statusHistory.create as jest.Mock).mockResolvedValue({});

      await handler(makeEvent({ body: JSON.stringify(validClassBody) }), {} as any);

      const created = (prisma.booking.create as jest.Mock).mock.calls[0][0].data;
      expect(created.holdExpiresAt).toBeInstanceOf(Date);
      expect(created.holdExpiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
