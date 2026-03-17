import { HandlerEvent } from "@netlify/functions";

jest.mock("../netlify/functions/helpers/prisma", () =>
  require("./__mocks__/prisma")
);
jest.mock("../netlify/functions/helpers/verifyAdmin", () => ({
  verifyAdminSession: jest.fn().mockResolvedValue({ isValid: true, email: "admin@test.com" }),
  unauthorizedResponse: jest.fn().mockReturnValue({
    statusCode: 401,
    headers: {},
    body: JSON.stringify({ success: false, error: "Unauthorized" }),
  }),
  getAdminHeaders: jest.fn().mockReturnValue({ "Content-Type": "application/json" }),
}));

import { handler } from "../netlify/functions/adminListClasses";
import { prisma } from "./__mocks__/prisma";
import { verifyAdminSession } from "../netlify/functions/helpers/verifyAdmin";

const makeEvent = (overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/adminListClasses",
  rawQuery: "",
  path: "/.netlify/functions/adminListClasses",
  httpMethod: "GET",
  headers: { origin: "http://localhost:3000" },
  multiValueHeaders: {},
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  body: null,
  isBase64Encoded: false,
  ...overrides,
});

const hours = (h: number) => h * 60 * 60 * 1000;

const makeClass = (overrides: any = {}) => ({
  id: "cls-1",
  title: "Yoga",
  startsAt: new Date(),
  endsAt: null,
  duration: 60,
  active: true,
  isRecurring: false,
  recurrenceDays: [],
  pricePaise: 50000,
  capacity: 20,
  spotsBooked: 5,
  _count: { bookings: 5 },
  ...overrides,
});

describe("adminListClasses handler", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Basic HTTP ──

  it("returns 204 for OPTIONS", async () => {
    const response = await handler(makeEvent({ httpMethod: "OPTIONS" }), {} as any);
    expect(response!.statusCode).toBe(204);
  });

  it("returns 405 for POST", async () => {
    const response = await handler(makeEvent({ httpMethod: "POST" }), {} as any);
    expect(response!.statusCode).toBe(405);
  });

  it("returns 401 when admin session is invalid", async () => {
    (verifyAdminSession as jest.Mock).mockResolvedValueOnce({
      isValid: false,
      error: "Not authenticated",
    });
    const response = await handler(makeEvent(), {} as any);
    expect(response!.statusCode).toBe(401);
  });

  // ── Successful listing ──

  it("returns 200 with classes list", async () => {
    const cls = makeClass({ startsAt: new Date(Date.now() + hours(24)) });
    (prisma.classSession.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([cls]);

    const response = await handler(makeEvent(), {} as any);
    expect(response!.statusCode).toBe(200);
    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Yoga");
  });

  it("adds isExpired flag based on startsAt + duration when no endsAt", async () => {
    const pastClass = makeClass({
      startsAt: new Date(Date.now() - hours(48)),
      endsAt: null,
      duration: 60,
      active: false,
    });
    (prisma.classSession.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([pastClass]);

    const response = await handler(makeEvent(), {} as any);
    const body = JSON.parse(response!.body!);
    expect(body.data[0].isExpired).toBe(true);
  });

  it("adds isExpired flag based on endsAt when set", async () => {
    const futureEndClass = makeClass({
      startsAt: new Date(Date.now() - hours(48)),
      endsAt: new Date(Date.now() + hours(48)),
      active: true,
    });
    (prisma.classSession.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([futureEndClass]);

    const response = await handler(makeEvent(), {} as any);
    const body = JSON.parse(response!.body!);
    expect(body.data[0].isExpired).toBe(false);
  });

  it("marks class as expired when endsAt is in the past", async () => {
    const expiredClass = makeClass({
      startsAt: new Date(Date.now() - hours(72)),
      endsAt: new Date(Date.now() - hours(24)),
      active: false,
    });
    (prisma.classSession.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([expiredClass]);

    const response = await handler(makeEvent(), {} as any);
    const body = JSON.parse(response!.body!);
    expect(body.data[0].isExpired).toBe(true);
  });

  // ── Auto-deactivation: non-recurring classes ──

  it("auto-deactivates non-recurring class with startsAt > 24h ago and no endsAt", async () => {
    (prisma.classSession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([]);

    await handler(makeEvent(), {} as any);

    const firstCall = (prisma.classSession.updateMany as jest.Mock).mock.calls[0][0];
    expect(firstCall.where.active).toBe(true);
    expect(firstCall.where.isRecurring).toBe(false);
    expect(firstCall.where.OR).toEqual(
      expect.arrayContaining([
        { endsAt: null },
        expect.objectContaining({ endsAt: expect.any(Object) }),
      ])
    );
    expect(firstCall.data).toEqual({ active: false });
  });

  it("does NOT auto-deactivate non-recurring class when endsAt is in the future", async () => {
    (prisma.classSession.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([]);

    await handler(makeEvent(), {} as any);

    const firstCall = (prisma.classSession.updateMany as jest.Mock).mock.calls[0][0];
    expect(firstCall.where.OR).toContainEqual({ endsAt: null });
    expect(firstCall.where.OR).toContainEqual(
      expect.objectContaining({ endsAt: { lt: expect.any(Date) } })
    );
  });

  // ── Auto-deactivation: recurring classes ──

  it("auto-deactivates recurring class when endsAt has passed", async () => {
    (prisma.classSession.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([]);

    await handler(makeEvent(), {} as any);

    const secondCall = (prisma.classSession.updateMany as jest.Mock).mock.calls[1][0];
    expect(secondCall.where.active).toBe(true);
    expect(secondCall.where.isRecurring).toBe(true);
    expect(secondCall.where.endsAt).toEqual({ not: null, lt: expect.any(Date) });
    expect(secondCall.data).toEqual({ active: false });
  });

  it("does NOT auto-deactivate recurring class with no endsAt", async () => {
    (prisma.classSession.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([]);

    await handler(makeEvent(), {} as any);

    const secondCall = (prisma.classSession.updateMany as jest.Mock).mock.calls[1][0];
    expect(secondCall.where.endsAt).toEqual({ not: null, lt: expect.any(Date) });
  });

  it("issues two separate updateMany calls (non-recurring and recurring)", async () => {
    (prisma.classSession.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([]);

    await handler(makeEvent(), {} as any);

    expect(prisma.classSession.updateMany).toHaveBeenCalledTimes(2);

    const call1 = (prisma.classSession.updateMany as jest.Mock).mock.calls[0][0];
    const call2 = (prisma.classSession.updateMany as jest.Mock).mock.calls[1][0];
    expect(call1.where.isRecurring).toBe(false);
    expect(call2.where.isRecurring).toBe(true);
  });

  // ── Error handling ──

  it("returns 500 when database throws", async () => {
    (prisma.classSession.updateMany as jest.Mock).mockRejectedValue(new Error("DB down"));

    const response = await handler(makeEvent(), {} as any);
    expect(response!.statusCode).toBe(500);
    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Failed to fetch classes");
  });
});
