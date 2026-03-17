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

import { handler } from "../netlify/functions/adminUpdateClass";
import { prisma } from "./__mocks__/prisma";
import { verifyAdminSession } from "../netlify/functions/helpers/verifyAdmin";

const makeEvent = (body: any, overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/adminUpdateClass",
  rawQuery: "",
  path: "/.netlify/functions/adminUpdateClass",
  httpMethod: "PUT",
  headers: { origin: "http://localhost:3000" },
  multiValueHeaders: {},
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  body: JSON.stringify(body),
  isBase64Encoded: false,
  ...overrides,
});

const existingClass = {
  id: "cls-1",
  title: "Old Yoga",
  startsAt: new Date(),
  endsAt: null,
  duration: 60,
  active: true,
  isRecurring: false,
};

describe("adminUpdateClass handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(existingClass);
    (prisma.classSession.update as jest.Mock).mockResolvedValue({ ...existingClass, title: "Updated" });
  });

  // ── Basic HTTP ──

  it("returns 204 for OPTIONS", async () => {
    const event = makeEvent({}, { httpMethod: "OPTIONS", body: null });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(204);
  });

  it("returns 405 for POST", async () => {
    const event = makeEvent({}, { httpMethod: "POST", body: null });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(405);
  });

  it("returns 401 when admin session is invalid", async () => {
    (verifyAdminSession as jest.Mock).mockResolvedValueOnce({
      isValid: false,
      error: "Not authenticated",
    });
    const event = makeEvent({ id: "cls-1", title: "New Title" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(401);
  });

  // ── Validation ──

  it("returns 400 when id is missing", async () => {
    const event = makeEvent({ title: "No ID" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(400);
  });

  it("returns 400 for title too short", async () => {
    const event = makeEvent({ id: "cls-1", title: "X" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(400);
  });

  it("returns 400 for invalid pricingType", async () => {
    const event = makeEvent({ id: "cls-1", pricingType: "WEEKLY" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(400);
  });

  it("returns 404 when class not found", async () => {
    (prisma.classSession.findUnique as jest.Mock).mockResolvedValue(null);

    const event = makeEvent({ id: "nonexistent-cls-1234", title: "Test" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(404);
    const body = JSON.parse(response!.body!);
    expect(body.error).toBe("Class not found");
  });

  // ── endsAt field handling ──

  it("sets endsAt to a Date when provided as ISO string", async () => {
    const endsAt = new Date(Date.now() + 86400000).toISOString();
    (prisma.classSession.update as jest.Mock).mockResolvedValue({ ...existingClass, endsAt });

    const event = makeEvent({ id: "cls-1", endsAt });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(200);

    const updateArgs = (prisma.classSession.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data.endsAt).toBeInstanceOf(Date);
    expect(updateArgs.data.endsAt.toISOString()).toBe(endsAt);
  });

  it("sets endsAt to null when explicitly passed as null (clears end date)", async () => {
    (prisma.classSession.update as jest.Mock).mockResolvedValue({ ...existingClass, endsAt: null });

    const event = makeEvent({ id: "cls-1", endsAt: null });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(200);

    const updateArgs = (prisma.classSession.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data.endsAt).toBeNull();
  });

  it("does NOT touch endsAt when field is omitted from payload", async () => {
    const event = makeEvent({ id: "cls-1", title: "Updated Yoga" });
    await handler(event, {} as any);

    const updateArgs = (prisma.classSession.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data.endsAt).toBeUndefined();
  });

  // ── startsAt handling ──

  it("converts startsAt string to Date when provided", async () => {
    const startsAt = new Date().toISOString();
    const event = makeEvent({ id: "cls-1", startsAt });
    await handler(event, {} as any);

    const updateArgs = (prisma.classSession.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data.startsAt).toBeInstanceOf(Date);
  });

  it("does NOT touch startsAt when not provided", async () => {
    const event = makeEvent({ id: "cls-1", title: "New Title" });
    await handler(event, {} as any);

    const updateArgs = (prisma.classSession.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data.startsAt).toBeUndefined();
  });

  // ── active toggle ──

  it("updates active status when provided", async () => {
    (prisma.classSession.update as jest.Mock).mockResolvedValue({ ...existingClass, active: false });

    const event = makeEvent({ id: "cls-1", active: false });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(200);

    const updateArgs = (prisma.classSession.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data.active).toBe(false);
  });

  // ── timeSlots handling ──

  it("updates timeSlots when provided", async () => {
    const timeSlots = [{ startTime: "09:00", endTime: "10:00" }];
    const event = makeEvent({ id: "cls-1", timeSlots });
    await handler(event, {} as any);

    const updateArgs = (prisma.classSession.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data.timeSlots).toBeDefined();
  });

  it("sets timeSlots to JsonNull when passed as null", async () => {
    const event = makeEvent({ id: "cls-1", timeSlots: null });
    await handler(event, {} as any);

    const updateArgs = (prisma.classSession.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data.timeSlots).toBeDefined();
  });

  it("does NOT touch timeSlots when omitted", async () => {
    const event = makeEvent({ id: "cls-1", title: "No slots change" });
    await handler(event, {} as any);

    const updateArgs = (prisma.classSession.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data).not.toHaveProperty("timeSlots");
  });

  // ── Partial updates ──

  it("only updates fields that are provided", async () => {
    const event = makeEvent({ id: "cls-1", title: "New Name Only" });
    await handler(event, {} as any);

    const updateArgs = (prisma.classSession.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "cls-1" });
    expect(updateArgs.data.title).toBe("New Name Only");
    expect(updateArgs.data.description).toBeUndefined();
    expect(updateArgs.data.duration).toBeUndefined();
  });

  it("updates multiple fields at once including endsAt", async () => {
    const endsAt = new Date(Date.now() + 86400000 * 30).toISOString();
    const event = makeEvent({
      id: "cls-1",
      title: "Updated Yoga",
      endsAt,
      active: true,
      duration: 90,
    });
    await handler(event, {} as any);

    const updateArgs = (prisma.classSession.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data.title).toBe("Updated Yoga");
    expect(updateArgs.data.endsAt).toBeInstanceOf(Date);
    expect(updateArgs.data.active).toBe(true);
    expect(updateArgs.data.duration).toBe(90);
  });

  // ── Error handling ──

  it("returns 500 when database throws on update", async () => {
    (prisma.classSession.update as jest.Mock).mockRejectedValue(new Error("DB error"));

    const event = makeEvent({ id: "cls-1", title: "Will Fail" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(500);

    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(false);
  });

  it("returns 500 when findUnique throws", async () => {
    (prisma.classSession.findUnique as jest.Mock).mockRejectedValue(new Error("DB error"));

    const event = makeEvent({ id: "cls-1", title: "Will Fail" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(500);
  });
});
