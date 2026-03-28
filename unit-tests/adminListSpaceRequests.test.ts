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

jest.mock("@prisma/client", () => ({
  SpaceRequestStatus: {
    REQUESTED: "REQUESTED",
    APPROVED_CALL_SCHEDULED: "APPROVED_CALL_SCHEDULED",
    CONFIRMED: "CONFIRMED",
    DECLINED: "DECLINED",
    CANCELLED: "CANCELLED",
  },
}));

import { handler } from "../netlify/functions/adminListSpaceRequests";
import { prisma } from "./__mocks__/prisma";
import { verifyAdminSession } from "../netlify/functions/helpers/verifyAdmin";

const makeEvent = (overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/adminListSpaceRequests",
  rawQuery: "", path: "/.netlify/functions/adminListSpaceRequests",
  httpMethod: "GET",
  headers: { origin: "http://localhost:3000" },
  multiValueHeaders: {}, queryStringParameters: null,
  multiValueQueryStringParameters: null, body: null, isBase64Encoded: false,
  ...overrides,
});

const mockRequest = {
  id: "sr-1",
  status: "REQUESTED",
  customerName: "Alice",
  purpose: "Photography shoot",
  createdAt: new Date(),
  booking: { id: "bk-1", status: "PENDING" },
};

describe("adminListSpaceRequests handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.spaceRequest.findMany as jest.Mock).mockResolvedValue([mockRequest]);
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

  it("returns 200 with space requests list", async () => {
    const res = await handler(makeEvent(), {} as any);
    expect(res!.statusCode).toBe(200);
    const body = JSON.parse(res!.body!);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("sr-1");
    expect(body.data[0].booking.id).toBe("bk-1");
  });

  it("lists all requests when no status filter", async () => {
    await handler(makeEvent(), {} as any);
    const args = (prisma.spaceRequest.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where).toEqual({});
  });

  // ── Status filter ──

  it("filters by valid status", async () => {
    await handler(makeEvent({ queryStringParameters: { status: "REQUESTED" } }), {} as any);
    const args = (prisma.spaceRequest.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where).toEqual({ status: "REQUESTED" });
  });

  it("filters by CONFIRMED status", async () => {
    await handler(makeEvent({ queryStringParameters: { status: "CONFIRMED" } }), {} as any);
    const args = (prisma.spaceRequest.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where).toEqual({ status: "CONFIRMED" });
  });

  it("filters by DECLINED status", async () => {
    await handler(makeEvent({ queryStringParameters: { status: "DECLINED" } }), {} as any);
    const args = (prisma.spaceRequest.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where).toEqual({ status: "DECLINED" });
  });

  it("ignores invalid status (returns all)", async () => {
    await handler(makeEvent({ queryStringParameters: { status: "FAKE_STATUS" } }), {} as any);
    const args = (prisma.spaceRequest.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where).toEqual({});
  });

  // ── Ordering ──

  it("orders by createdAt descending", async () => {
    await handler(makeEvent(), {} as any);
    const args = (prisma.spaceRequest.findMany as jest.Mock).mock.calls[0][0];
    expect(args.orderBy).toEqual({ createdAt: "desc" });
  });

  // ── Includes ──

  it("includes booking relation via select", async () => {
    await handler(makeEvent(), {} as any);
    const args = (prisma.spaceRequest.findMany as jest.Mock).mock.calls[0][0];
    expect(args.select.booking).toBeDefined();
    expect(args.select.booking.select.id).toBe(true);
    expect(args.select.booking.select.status).toBe(true);
  });

  // ── Error handling ──

  it("returns 500 when database throws", async () => {
    (prisma.spaceRequest.findMany as jest.Mock).mockRejectedValue(new Error("DB down"));
    const res = await handler(makeEvent(), {} as any);
    expect(res!.statusCode).toBe(500);
    expect(JSON.parse(res!.body!).error).toBe("Failed to fetch space requests");
  });
});
