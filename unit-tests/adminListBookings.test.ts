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
jest.mock("../netlify/functions/helpers/security", () => ({
  getClientIP: jest.fn().mockReturnValue("127.0.0.1"),
  isRateLimited: jest.fn().mockReturnValue(false),
  rateLimitResponse: jest.fn().mockReturnValue({
    statusCode: 429, headers: {}, body: JSON.stringify({ success: false, error: "Rate limited" }),
  }),
  RATE_LIMITS: { ADMIN_READ: { maxRequests: 100, windowMs: 60000 } },
}));

import { handler } from "../netlify/functions/adminListBookings";
import { prisma } from "./__mocks__/prisma";
import { verifyAdminSession } from "../netlify/functions/helpers/verifyAdmin";
import { isRateLimited } from "../netlify/functions/helpers/security";

const makeEvent = (overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/adminListBookings",
  rawQuery: "", path: "/.netlify/functions/adminListBookings",
  httpMethod: "GET",
  headers: { origin: "http://localhost:3000" },
  multiValueHeaders: {}, queryStringParameters: null,
  multiValueQueryStringParameters: null, body: null, isBase64Encoded: false,
  ...overrides,
});

const mockBooking = {
  id: "bk-1",
  type: "CLASS",
  status: "CONFIRMED",
  customerName: "John",
  customerEmail: "john@test.com",
  createdAt: new Date(),
  classSession: { title: "Yoga" },
  event: null,
  spaceRequest: null,
  payments: [],
  eventPass: null,
};

describe("adminListBookings handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([mockBooking]);
    (prisma.booking.count as jest.Mock).mockResolvedValue(1);
  });

  it("returns 204 for OPTIONS", async () => {
    const res = await handler(makeEvent({ httpMethod: "OPTIONS" }), {} as any);
    expect(res!.statusCode).toBe(204);
  });

  it("returns 405 for POST", async () => {
    const res = await handler(makeEvent({ httpMethod: "POST" }), {} as any);
    expect(res!.statusCode).toBe(405);
  });

  it("returns 429 when rate limited", async () => {
    (isRateLimited as jest.Mock).mockReturnValueOnce(true);
    const res = await handler(makeEvent(), {} as any);
    expect(res!.statusCode).toBe(429);
  });

  it("returns 401 when admin session is invalid", async () => {
    (verifyAdminSession as jest.Mock).mockResolvedValueOnce({ isValid: false, error: "Nope" });
    const res = await handler(makeEvent(), {} as any);
    expect(res!.statusCode).toBe(401);
  });

  // ── Successful listing ──

  it("returns 200 with bookings, total, page, totalPages", async () => {
    const res = await handler(makeEvent(), {} as any);
    expect(res!.statusCode).toBe(200);
    const body = JSON.parse(res!.body!);
    expect(body.success).toBe(true);
    expect(body.data.bookings).toHaveLength(1);
    expect(body.data.total).toBe(1);
    expect(body.data.page).toBe(1);
    expect(body.data.totalPages).toBe(1);
  });

  // ── Pagination ──

  it("defaults to page 1, limit 20", async () => {
    await handler(makeEvent(), {} as any);
    const args = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(args.skip).toBe(0);
    expect(args.take).toBe(20);
  });

  it("respects page and limit query params", async () => {
    await handler(makeEvent({ queryStringParameters: { page: "3", limit: "10" } }), {} as any);
    const args = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(args.skip).toBe(20);
    expect(args.take).toBe(10);
  });

  it("caps limit at 100", async () => {
    await handler(makeEvent({ queryStringParameters: { limit: "500" } }), {} as any);
    const args = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(args.take).toBe(100);
  });

  it("handles invalid page gracefully (defaults to 1)", async () => {
    await handler(makeEvent({ queryStringParameters: { page: "abc" } }), {} as any);
    const args = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(args.skip).toBe(0);
  });

  it("computes totalPages correctly", async () => {
    (prisma.booking.count as jest.Mock).mockResolvedValue(55);
    const res = await handler(makeEvent({ queryStringParameters: { limit: "10" } }), {} as any);
    const body = JSON.parse(res!.body!);
    expect(body.data.totalPages).toBe(6);
  });

  // ── Filters ──

  it("filters by type when valid BookingType provided", async () => {
    await handler(makeEvent({ queryStringParameters: { type: "CLASS" } }), {} as any);
    const args = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.type).toBe("CLASS");
  });

  it("ignores invalid type values", async () => {
    await handler(makeEvent({ queryStringParameters: { type: "INVALID" } }), {} as any);
    const args = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.type).toBeUndefined();
  });

  it("filters by status when valid BookingStatus provided", async () => {
    await handler(makeEvent({ queryStringParameters: { status: "CONFIRMED" } }), {} as any);
    const args = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.status).toBe("CONFIRMED");
  });

  it("ignores invalid status values", async () => {
    await handler(makeEvent({ queryStringParameters: { status: "FAKE" } }), {} as any);
    const args = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.status).toBeUndefined();
  });

  // ── Date filters ──

  it("filters by startDate", async () => {
    await handler(makeEvent({ queryStringParameters: { startDate: "2025-01-01" } }), {} as any);
    const args = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("filters by endDate", async () => {
    await handler(makeEvent({ queryStringParameters: { endDate: "2025-12-31" } }), {} as any);
    const args = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.createdAt.lte).toBeInstanceOf(Date);
  });

  it("returns 400 for invalid startDate format", async () => {
    const res = await handler(makeEvent({ queryStringParameters: { startDate: "not-a-date" } }), {} as any);
    expect(res!.statusCode).toBe(400);
    expect(JSON.parse(res!.body!).error).toContain("startDate");
  });

  it("returns 400 for invalid endDate format", async () => {
    const res = await handler(makeEvent({ queryStringParameters: { endDate: "31/12/2025" } }), {} as any);
    expect(res!.statusCode).toBe(400);
    expect(JSON.parse(res!.body!).error).toContain("endDate");
  });

  // ── Search ──

  it("adds OR search conditions for name, email, id", async () => {
    await handler(makeEvent({ queryStringParameters: { search: "John" } }), {} as any);
    const args = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.OR).toHaveLength(3);
    expect(args.where.OR[0].customerName.contains).toBe("John");
    expect(args.where.OR[1].customerEmail.contains).toBe("John");
    expect(args.where.OR[2].id.contains).toBe("John");
  });

  it("sanitizes search input (strips special characters)", async () => {
    await handler(makeEvent({ queryStringParameters: { search: "<script>alert('xss')</script>" } }), {} as any);
    const args = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    const searchTerm = args.where.OR[0].customerName.contains;
    expect(searchTerm).not.toContain("<");
    expect(searchTerm).not.toContain(">");
    expect(searchTerm).not.toContain("'");
  });

  it("truncates search to MAX_SEARCH_LENGTH", async () => {
    const longSearch = "a".repeat(200);
    await handler(makeEvent({ queryStringParameters: { search: longSearch } }), {} as any);
    const args = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    const searchTerm = args.where.OR[0].customerName.contains;
    expect(searchTerm.length).toBeLessThanOrEqual(100);
  });

  it("skips search filter when sanitized result is empty", async () => {
    await handler(makeEvent({ queryStringParameters: { search: "<<<>>>" } }), {} as any);
    const args = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.OR).toBeUndefined();
  });

  // ── Ordering ──

  it("orders by createdAt descending", async () => {
    await handler(makeEvent(), {} as any);
    const args = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
    expect(args.orderBy).toEqual({ createdAt: "desc" });
  });

  // ── Error handling ──

  it("returns 500 when database throws", async () => {
    (prisma.booking.findMany as jest.Mock).mockRejectedValue(new Error("DB error"));
    const res = await handler(makeEvent(), {} as any);
    expect(res!.statusCode).toBe(500);
    expect(JSON.parse(res!.body!).error).toBe("Failed to fetch bookings");
  });
});
