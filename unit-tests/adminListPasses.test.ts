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

import { handler } from "../netlify/functions/adminListPasses";
import { prisma } from "./__mocks__/prisma";
import { verifyAdminSession } from "../netlify/functions/helpers/verifyAdmin";

const makeEvent = (overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/adminListPasses",
  rawQuery: "", path: "/.netlify/functions/adminListPasses",
  httpMethod: "GET",
  headers: { origin: "http://localhost:3000" },
  multiValueHeaders: {}, queryStringParameters: null,
  multiValueQueryStringParameters: null, body: null, isBase64Encoded: false,
  ...overrides,
});

const mockPass = {
  id: "pass-1",
  passId: "OSS-EV-ABCD1234",
  checkInStatus: "NOT_CHECKED_IN",
  checkInTime: null,
  checkedInBy: null,
  createdAt: new Date(),
  event: { title: "Open Mic", startsAt: new Date() },
  booking: {
    customerName: "John Doe",
    customerEmail: "john@test.com",
    customerPhone: "+919876543210",
  },
};

describe("adminListPasses handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.eventPass.findMany as jest.Mock).mockResolvedValue([mockPass]);
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
    (verifyAdminSession as jest.Mock).mockResolvedValueOnce({ isValid: false, error: "Nope" });
    const res = await handler(makeEvent(), {} as any);
    expect(res!.statusCode).toBe(401);
  });

  // ── Successful listing ──

  it("returns 200 with mapped pass data", async () => {
    const res = await handler(makeEvent(), {} as any);
    expect(res!.statusCode).toBe(200);
    const body = JSON.parse(res!.body!);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);

    const pass = body.data[0];
    expect(pass.passId).toBe("OSS-EV-ABCD1234");
    expect(pass.checkInStatus).toBe("NOT_CHECKED_IN");
    expect(pass.eventTitle).toBe("Open Mic");
    expect(pass.attendeeName).toBe("John Doe");
    expect(pass.attendeeEmail).toBe("john@test.com");
    expect(pass.attendeePhone).toBe("+919876543210");
  });

  it("lists all passes when no eventId filter", async () => {
    await handler(makeEvent(), {} as any);
    const args = (prisma.eventPass.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where).toEqual({});
  });

  // ── eventId filter ──

  it("filters by eventId when provided", async () => {
    const eventId = "clx1234567890abcdefgh";
    await handler(makeEvent({ queryStringParameters: { eventId } }), {} as any);
    const args = (prisma.eventPass.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where).toEqual({ eventId });
  });

  it("returns 400 for invalid eventId format", async () => {
    const res = await handler(
      makeEvent({ queryStringParameters: { eventId: "DROP TABLE events;--" } }),
      {} as any,
    );
    expect(res!.statusCode).toBe(400);
    expect(JSON.parse(res!.body!).error).toContain("Invalid eventId");
  });

  it("accepts UUID-format eventId", async () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    await handler(makeEvent({ queryStringParameters: { eventId: uuid } }), {} as any);
    const args = (prisma.eventPass.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where).toEqual({ eventId: uuid });
  });

  // ── Ordering ──

  it("orders by createdAt descending", async () => {
    await handler(makeEvent(), {} as any);
    const args = (prisma.eventPass.findMany as jest.Mock).mock.calls[0][0];
    expect(args.orderBy).toEqual({ createdAt: "desc" });
  });

  // ── Response shape ──

  it("maps pass fields correctly and strips raw relations", async () => {
    const res = await handler(makeEvent(), {} as any);
    const body = JSON.parse(res!.body!);
    const pass = body.data[0];
    expect(pass).toHaveProperty("id");
    expect(pass).toHaveProperty("passId");
    expect(pass).toHaveProperty("checkInStatus");
    expect(pass).toHaveProperty("eventTitle");
    expect(pass).toHaveProperty("eventDate");
    expect(pass).toHaveProperty("attendeeName");
    expect(pass).toHaveProperty("attendeeEmail");
    expect(pass).toHaveProperty("attendeePhone");
    expect(pass).toHaveProperty("createdAt");
    expect(pass).not.toHaveProperty("event");
    expect(pass).not.toHaveProperty("booking");
  });

  // ── Error handling ──

  it("returns 500 when database throws", async () => {
    (prisma.eventPass.findMany as jest.Mock).mockRejectedValue(new Error("DB down"));
    const res = await handler(makeEvent(), {} as any);
    expect(res!.statusCode).toBe(500);
    expect(JSON.parse(res!.body!).error).toBe("Failed to fetch passes");
  });
});
