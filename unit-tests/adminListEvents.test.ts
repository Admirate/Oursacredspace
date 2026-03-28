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
  _count: { bookings: 3, eventPasses: 5 },
  eventPasses: [
    { checkInStatus: "CHECKED_IN" },
    { checkInStatus: "NOT_CHECKED_IN" },
    { checkInStatus: "CHECKED_IN" },
    { checkInStatus: "NOT_CHECKED_IN" },
    { checkInStatus: "NOT_CHECKED_IN" },
  ],
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

  // ── Stats computation ──

  it("computes passesIssued from _count.eventPasses", async () => {
    (prisma.event.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.event.findMany as jest.Mock).mockResolvedValue([makeEventRecord()]);

    const res = await handler(makeEvent(), {} as any);
    const body = JSON.parse(res!.body!);
    expect(body.data[0].passesIssued).toBe(5);
  });

  it("computes checkIns count from eventPasses with CHECKED_IN status", async () => {
    (prisma.event.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.event.findMany as jest.Mock).mockResolvedValue([makeEventRecord()]);

    const res = await handler(makeEvent(), {} as any);
    const body = JSON.parse(res!.body!);
    expect(body.data[0].checkIns).toBe(2);
  });

  it("strips eventPasses array from response", async () => {
    (prisma.event.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.event.findMany as jest.Mock).mockResolvedValue([makeEventRecord()]);

    const res = await handler(makeEvent(), {} as any);
    const body = JSON.parse(res!.body!);
    expect(body.data[0].eventPasses).toBeUndefined();
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
