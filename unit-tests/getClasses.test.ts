import { HandlerEvent } from "@netlify/functions";

jest.mock("../netlify/functions/helpers/prisma", () =>
  require("./__mocks__/prisma")
);
jest.mock("../netlify/functions/helpers/security", () => ({
  getClientIP: jest.fn().mockReturnValue("127.0.0.1"),
  isRateLimited: jest.fn().mockReturnValue(false),
  rateLimitResponse: jest.fn().mockReturnValue({
    statusCode: 429,
    headers: {},
    body: JSON.stringify({ success: false, error: "Rate limited" }),
  }),
  RATE_LIMITS: { PUBLIC_READ: { maxRequests: 100, windowMs: 60000 } },
  getPublicHeaders: jest.fn().mockReturnValue({ "Content-Type": "application/json" }),
}));

import { handler } from "../netlify/functions/getClasses";
import { prisma } from "./__mocks__/prisma";
import { isRateLimited } from "../netlify/functions/helpers/security";

const makeEvent = (overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/getClasses",
  rawQuery: "",
  path: "/.netlify/functions/getClasses",
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
  title: "Yoga Basics",
  startsAt: new Date(Date.now() + hours(24)),
  endsAt: null,
  duration: 60,
  active: true,
  isRecurring: false,
  capacity: 20,
  pricePaise: 50000,
  deletedAt: null,
  _count: { bookings: 3 },
  ...overrides,
});

describe("getClasses handler", () => {
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

  it("returns 429 when rate limited", async () => {
    (isRateLimited as jest.Mock).mockReturnValueOnce(true);
    const response = await handler(makeEvent(), {} as any);
    expect(response!.statusCode).toBe(429);
  });

  // ── Successful fetch ──

  it("returns 200 with classes and computed availability", async () => {
    const cls = makeClass({ capacity: 20, _count: { bookings: 5 } });
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([cls]);

    const response = await handler(makeEvent(), {} as any);
    expect(response!.statusCode).toBe(200);

    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].bookedCount).toBe(5);
    expect(body.data[0].availableSpots).toBe(15);
  });

  it("returns null availableSpots when capacity is null (unlimited)", async () => {
    const cls = makeClass({ capacity: null, _count: { bookings: 10 } });
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([cls]);

    const response = await handler(makeEvent(), {} as any);
    const body = JSON.parse(response!.body!);
    expect(body.data[0].availableSpots).toBeNull();
  });

  it("clamps availableSpots to 0 when overbooked", async () => {
    const cls = makeClass({ capacity: 5, _count: { bookings: 8 } });
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([cls]);

    const response = await handler(makeEvent(), {} as any);
    const body = JSON.parse(response!.body!);
    expect(body.data[0].availableSpots).toBe(0);
  });

  it("strips _count from response", async () => {
    const cls = makeClass();
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([cls]);

    const response = await handler(makeEvent(), {} as any);
    const body = JSON.parse(response!.body!);
    expect(body.data[0]._count).toBeUndefined();
  });

  // ── Filtering logic (default: active only) ──

  it("applies active filter by default", async () => {
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([]);

    await handler(makeEvent(), {} as any);

    const findManyArgs = (prisma.classSession.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyArgs.where.active).toBe(true);
    expect(findManyArgs.where.deletedAt).toBeNull();
  });

  it("includes OR conditions for recurring, startsAt, and endsAt in default filter", async () => {
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([]);

    await handler(makeEvent(), {} as any);

    const findManyArgs = (prisma.classSession.findMany as jest.Mock).mock.calls[0][0];
    const orConditions = findManyArgs.where.OR;
    expect(orConditions).toBeDefined();
    expect(orConditions).toHaveLength(3);

    // First condition: recurring classes with no/future end date
    expect(orConditions[0].isRecurring).toBe(true);
    expect(orConditions[0].OR).toBeDefined();

    // Second condition: future startsAt
    expect(orConditions[1].startsAt).toBeDefined();
    expect(orConditions[1].startsAt.gte).toBeInstanceOf(Date);

    // Third condition: future endsAt
    expect(orConditions[2].endsAt).toBeDefined();
    expect(orConditions[2].endsAt.gte).toBeInstanceOf(Date);
  });

  it("recurring condition checks for null or future endsAt", async () => {
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([]);

    await handler(makeEvent(), {} as any);

    const findManyArgs = (prisma.classSession.findMany as jest.Mock).mock.calls[0][0];
    const recurringCondition = findManyArgs.where.OR[0];
    expect(recurringCondition.isRecurring).toBe(true);
    expect(recurringCondition.OR).toEqual([
      { endsAt: null },
      { endsAt: { gte: expect.any(Date) } },
    ]);
  });

  // ── includeInactive ──

  it("skips all filters when includeInactive=true", async () => {
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([]);

    const event = makeEvent({
      queryStringParameters: { includeInactive: "true" },
    });
    await handler(event, {} as any);

    const findManyArgs = (prisma.classSession.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyArgs.where).toEqual({});
  });

  it("applies filters when includeInactive is not 'true'", async () => {
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([]);

    const event = makeEvent({
      queryStringParameters: { includeInactive: "false" },
    });
    await handler(event, {} as any);

    const findManyArgs = (prisma.classSession.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyArgs.where.active).toBe(true);
  });

  // ── Ordering ──

  it("orders by startsAt ascending", async () => {
    (prisma.classSession.findMany as jest.Mock).mockResolvedValue([]);

    await handler(makeEvent(), {} as any);

    const findManyArgs = (prisma.classSession.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyArgs.orderBy).toEqual({ startsAt: "asc" });
  });

  // ── Error handling ──

  it("returns 500 when database throws", async () => {
    (prisma.classSession.findMany as jest.Mock).mockRejectedValue(new Error("Connection lost"));

    const response = await handler(makeEvent(), {} as any);
    expect(response!.statusCode).toBe(500);
    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Failed to fetch classes");
  });
});
