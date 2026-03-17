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

import { handler } from "../netlify/functions/adminUpdateEvent";
import { prisma } from "./__mocks__/prisma";
import { verifyAdminSession } from "../netlify/functions/helpers/verifyAdmin";

const makeEvent = (body: any, overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/adminUpdateEvent",
  rawQuery: "", path: "/.netlify/functions/adminUpdateEvent",
  httpMethod: "PUT",
  headers: { origin: "http://localhost:3000" },
  multiValueHeaders: {}, queryStringParameters: null,
  multiValueQueryStringParameters: null,
  body: JSON.stringify(body), isBase64Encoded: false,
  ...overrides,
});

const existingEvent = {
  id: "evt-1", title: "Old Event", startsAt: new Date(), endsAt: null, active: true, venue: "Hall",
};

describe("adminUpdateEvent handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.event.findUnique as jest.Mock).mockResolvedValue(existingEvent);
    (prisma.event.update as jest.Mock).mockResolvedValue({ ...existingEvent, title: "Updated" });
  });

  it("returns 204 for OPTIONS", async () => {
    const res = await handler(makeEvent({}, { httpMethod: "OPTIONS", body: null }), {} as any);
    expect(res!.statusCode).toBe(204);
  });

  it("returns 405 for POST", async () => {
    const res = await handler(makeEvent({}, { httpMethod: "POST", body: null }), {} as any);
    expect(res!.statusCode).toBe(405);
  });

  it("returns 401 when admin session is invalid", async () => {
    (verifyAdminSession as jest.Mock).mockResolvedValueOnce({ isValid: false, error: "Nope" });
    const res = await handler(makeEvent({ id: "evt-1", title: "X" }), {} as any);
    expect(res!.statusCode).toBe(401);
  });

  // ── Validation ──

  it("returns 400 when id is missing", async () => {
    const res = await handler(makeEvent({ title: "No ID" }), {} as any);
    expect(res!.statusCode).toBe(400);
  });

  it("returns 400 for title too short", async () => {
    const res = await handler(makeEvent({ id: "evt-1", title: "X" }), {} as any);
    expect(res!.statusCode).toBe(400);
  });

  it("returns 404 when event not found", async () => {
    (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await handler(makeEvent({ id: "nonexistent-evt-123", title: "Test" }), {} as any);
    expect(res!.statusCode).toBe(404);
    expect(JSON.parse(res!.body!).error).toBe("Event not found");
  });

  // ── endsAt 3-way handling ──

  it("sets endsAt to Date when provided as ISO string", async () => {
    const endsAt = new Date(Date.now() + 86400000).toISOString();
    await handler(makeEvent({ id: "evt-1", endsAt }), {} as any);
    const args = (prisma.event.update as jest.Mock).mock.calls[0][0];
    expect(args.data.endsAt).toBeInstanceOf(Date);
    expect(args.data.endsAt.toISOString()).toBe(endsAt);
  });

  it("sets endsAt to null when explicitly passed as null", async () => {
    await handler(makeEvent({ id: "evt-1", endsAt: null }), {} as any);
    const args = (prisma.event.update as jest.Mock).mock.calls[0][0];
    expect(args.data.endsAt).toBeNull();
  });

  it("does NOT touch endsAt when omitted from payload", async () => {
    await handler(makeEvent({ id: "evt-1", title: "New Title" }), {} as any);
    const args = (prisma.event.update as jest.Mock).mock.calls[0][0];
    expect(args.data.endsAt).toBeUndefined();
  });

  // ── startsAt handling ──

  it("converts startsAt to Date when provided", async () => {
    const startsAt = new Date().toISOString();
    await handler(makeEvent({ id: "evt-1", startsAt }), {} as any);
    const args = (prisma.event.update as jest.Mock).mock.calls[0][0];
    expect(args.data.startsAt).toBeInstanceOf(Date);
  });

  it("does NOT touch startsAt when omitted", async () => {
    await handler(makeEvent({ id: "evt-1", title: "Update" }), {} as any);
    const args = (prisma.event.update as jest.Mock).mock.calls[0][0];
    expect(args.data.startsAt).toBeUndefined();
  });

  // ── Partial updates ──

  it("only updates provided fields", async () => {
    await handler(makeEvent({ id: "evt-1", title: "New" }), {} as any);
    const args = (prisma.event.update as jest.Mock).mock.calls[0][0];
    expect(args.where).toEqual({ id: "evt-1" });
    expect(args.data.title).toBe("New");
    expect(args.data.venue).toBeUndefined();
    expect(args.data.pricePaise).toBeUndefined();
  });

  it("updates active status", async () => {
    await handler(makeEvent({ id: "evt-1", active: false }), {} as any);
    const args = (prisma.event.update as jest.Mock).mock.calls[0][0];
    expect(args.data.active).toBe(false);
  });

  it("updates multiple fields at once", async () => {
    const endsAt = new Date(Date.now() + 86400000 * 7).toISOString();
    await handler(makeEvent({ id: "evt-1", title: "Updated", venue: "New Venue", endsAt }), {} as any);
    const args = (prisma.event.update as jest.Mock).mock.calls[0][0];
    expect(args.data.title).toBe("Updated");
    expect(args.data.venue).toBe("New Venue");
    expect(args.data.endsAt).toBeInstanceOf(Date);
  });

  // ── Error handling ──

  it("returns 500 when database throws on update", async () => {
    (prisma.event.update as jest.Mock).mockRejectedValue(new Error("DB error"));
    const res = await handler(makeEvent({ id: "evt-1", title: "Fail" }), {} as any);
    expect(res!.statusCode).toBe(500);
    expect(JSON.parse(res!.body!).success).toBe(false);
  });

  it("returns 500 when findUnique throws", async () => {
    (prisma.event.findUnique as jest.Mock).mockRejectedValue(new Error("DB error"));
    const res = await handler(makeEvent({ id: "evt-1", title: "Fail" }), {} as any);
    expect(res!.statusCode).toBe(500);
  });
});
