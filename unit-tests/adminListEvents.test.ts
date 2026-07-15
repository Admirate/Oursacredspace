import { HandlerEvent } from "@netlify/functions";

jest.mock("../netlify/functions/helpers/prisma", () =>
  require("./__mocks__/prisma")
);
jest.mock("../netlify/functions/helpers/verifyAdmin", () => ({
  verifyAdminSession: jest.fn().mockResolvedValue({ isValid: true, email: "admin@test.com" }),
  unauthorizedResponse: jest.fn().mockReturnValue({
    statusCode: 401, headers: {}, body: JSON.stringify({ success: false, error: "Unauthorized" }),
  }),
  getAdminHeaders: jest.fn().mockReturnValue({ "Content-Type": "application/json" }),
}));

import { handler } from "../netlify/functions/adminListEvents";
import { prisma } from "./__mocks__/prisma";
import { verifyAdminSession } from "../netlify/functions/helpers/verifyAdmin";

const makeEvent = (overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/adminListEvents",
  rawQuery: "", path: "/.netlify/functions/adminListEvents",
  httpMethod: "GET",
  headers: { origin: "http://localhost:3000" },
  multiValueHeaders: {}, queryStringParameters: null,
  multiValueQueryStringParameters: null, body: null, isBase64Encoded: false,
  ...overrides,
});

const hours = (h: number) => h * 60 * 60 * 1000;

const makeEventRecord = (overrides: any = {}) => ({
  id: "evt-1",
  title: "Open Mic",
  startsAt: new Date(Date.now() + hours(24)),
  endsAt: null,
  active: true,
  _count: { bookings: 3 },
  ...overrides,
});

describe("adminListEvents handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.event.count as jest.Mock).mockResolvedValue(0);
  });

  it("returns 204 for OPTIONS", async () => {
    const res = await handler(makeEvent({ httpMethod: "OPTIONS" }), {} as any);
    expect(res!.statusCode).toBe(204);
  });

  it("returns 405 for POST", async () => {
    const res = await handler(makeEvent({ httpMethod: "POST" }), {} as any);
    expect(res!.statusCode).toBe(405);
  });

  it("returns 401 when admin session is invalid", async () => {
    (verifyAdminSession as jest.Mock).mockResolvedValueOnce({ isValid: false, error: "Not authenticated" });
    const res = await handler(makeEvent(), {} as any);
    expect(res!.statusCode).toBe(401);
  });

  // ── Successful listing ──

  it("returns 200 with events list", async () => {
    (prisma.event.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.event.findMany as jest.Mock).mockResolvedValue([makeEventRecord()]);

    const res = await handler(makeEvent(), {} as any);
    expect(res!.statusCode).toBe(200);
    const body = JSON.parse(res!.body!);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Open Mic");
  });

  // ── Derived occupancy (P5 fix) ──
  // Occupancy must be the true seat count: SUM(quantity) of seat-occupying
  // bookings (multi-seat aware), NOT an unfiltered booking row count.

  it("returns a derived bookedCount summed from seat-occupying bookings", async () => {
    (prisma.event.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      makeEventRecord({ id: "evt-1", capacity: 50, _count: { bookings: 99 } }),
    ]);
    // e.g. one booking of 8 passes + one of 4 = 12 seats occupied
    (prisma.booking.groupBy as jest.Mock).mockResolvedValue([
      { eventId: "evt-1", _sum: { quantity: 12 } },
    ]);

    const res = await handler(makeEvent(), {} as any);
    const body = JSON.parse(res!.body!);
    expect(body.data[0].bookedCount).toBe(12);
    expect(body.data[0].availableSpots).toBe(38); // 50 - 12
  });

  it("returns null availableSpots for unlimited-capacity events", async () => {
    (prisma.event.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      makeEventRecord({ id: "evt-1", capacity: null }),
    ]);
    (prisma.booking.groupBy as jest.Mock).mockResolvedValue([
      { eventId: "evt-1", _sum: { quantity: 6 } },
    ]);

    const res = await handler(makeEvent(), {} as any);
    const body = JSON.parse(res!.body!);
    expect(body.data[0].bookedCount).toBe(6);
    expect(body.data[0].availableSpots).toBeNull();
  });

  it("reports bookedCount 0 when an event has no seat-occupying bookings", async () => {
    (prisma.event.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      makeEventRecord({ id: "evt-1", capacity: 30 }),
    ]);
    (prisma.booking.groupBy as jest.Mock).mockResolvedValue([]);

    const res = await handler(makeEvent(), {} as any);
    const body = JSON.parse(res!.body!);
    expect(body.data[0].bookedCount).toBe(0);
    expect(body.data[0].availableSpots).toBe(30);
  });

  // ── isExpired logic ──

  it("marks event as not expired when startsAt is in the future", async () => {
    (prisma.event.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      makeEventRecord({ startsAt: new Date(Date.now() + hours(24)), endsAt: null }),
    ]);

    const res = await handler(makeEvent(), {} as any);
    const body = JSON.parse(res!.body!);
    expect(body.data[0].isExpired).toBe(false);
  });

  it("uses endsAt for expiry check when available", async () => {
    (prisma.event.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      makeEventRecord({
        startsAt: new Date(Date.now() - hours(48)),
        endsAt: new Date(Date.now() + hours(24)),
      }),
    ]);

    const res = await handler(makeEvent(), {} as any);
    const body = JSON.parse(res!.body!);
    expect(body.data[0].isExpired).toBe(false);
  });

  it("marks event as expired when endsAt is in the past", async () => {
    (prisma.event.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      makeEventRecord({
        startsAt: new Date(Date.now() - hours(72)),
        endsAt: new Date(Date.now() - hours(24)),
        active: false,
      }),
    ]);

    const res = await handler(makeEvent(), {} as any);
    const body = JSON.parse(res!.body!);
    expect(body.data[0].isExpired).toBe(true);
  });

  it("falls back to startsAt for expiry when endsAt is null", async () => {
    (prisma.event.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      makeEventRecord({
        startsAt: new Date(Date.now() - hours(48)),
        endsAt: null,
        active: false,
      }),
    ]);

    const res = await handler(makeEvent(), {} as any);
    const body = JSON.parse(res!.body!);
    expect(body.data[0].isExpired).toBe(true);
  });

  // ── Auto-deactivation ──

  it("auto-deactivates events with startsAt > 24h ago", async () => {
    (prisma.event.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
    (prisma.event.findMany as jest.Mock).mockResolvedValue([]);

    await handler(makeEvent(), {} as any);

    expect(prisma.event.updateMany).toHaveBeenCalledWith({
      where: {
        active: true,
        deletedAt: null,
        startsAt: { lt: expect.any(Date) },
      },
      data: { active: false },
    });
  });

  // ── Error handling ──

  it("returns 500 when database throws", async () => {
    (prisma.event.updateMany as jest.Mock).mockRejectedValue(new Error("DB error"));

    const res = await handler(makeEvent(), {} as any);
    expect(res!.statusCode).toBe(500);
    const body = JSON.parse(res!.body!);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Failed to fetch events");
  });
});
