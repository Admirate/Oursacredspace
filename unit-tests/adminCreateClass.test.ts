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

import { handler } from "../netlify/functions/adminCreateClass";
import { prisma } from "./__mocks__/prisma";
import { verifyAdminSession } from "../netlify/functions/helpers/verifyAdmin";

const makeEvent = (body: any, overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/adminCreateClass",
  rawQuery: "",
  path: "/.netlify/functions/adminCreateClass",
  httpMethod: "POST",
  headers: { origin: "http://localhost:3000" },
  multiValueHeaders: {},
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  body: JSON.stringify(body),
  isBase64Encoded: false,
  ...overrides,
});

const validClassPayload = {
  title: "Morning Yoga",
  description: "A beginner-friendly yoga class",
  startsAt: new Date().toISOString(),
  duration: 60,
  pricePaise: 50000,
  capacity: 20,
  active: true,
  isRecurring: false,
  recurrenceDays: [],
  pricingType: "PER_SESSION" as const,
};

describe("adminCreateClass handler", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Basic HTTP ──

  it("returns 204 for OPTIONS", async () => {
    const event = makeEvent({}, { httpMethod: "OPTIONS", body: null });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(204);
  });

  it("returns 405 for GET", async () => {
    const event = makeEvent({}, { httpMethod: "GET", body: null });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(405);
  });

  it("returns 401 when admin session is invalid", async () => {
    (verifyAdminSession as jest.Mock).mockResolvedValueOnce({
      isValid: false,
      error: "Not authenticated",
    });
    const event = makeEvent(validClassPayload);
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(401);
  });

  // ── Validation ──

  it("returns 400 for missing title", async () => {
    const { title, ...noTitle } = validClassPayload;
    const event = makeEvent(noTitle);
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(400);
  });

  it("returns 400 for title too short", async () => {
    const event = makeEvent({ ...validClassPayload, title: "X" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(400);
  });

  it("returns 400 for duration below 15 minutes", async () => {
    const event = makeEvent({ ...validClassPayload, duration: 5 });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(400);
  });

  it("returns 400 for duration above 480 minutes", async () => {
    const event = makeEvent({ ...validClassPayload, duration: 500 });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(400);
  });

  it("returns 400 for negative price", async () => {
    const event = makeEvent({ ...validClassPayload, pricePaise: -100 });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(400);
  });

  it("returns 400 for invalid pricingType", async () => {
    const event = makeEvent({ ...validClassPayload, pricingType: "PER_YEAR" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(400);
  });

  it("returns 400 for invalid recurrenceDays values", async () => {
    const event = makeEvent({ ...validClassPayload, recurrenceDays: [7, 8] });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(400);
  });

  it("returns 400 for invalid timeSlot format", async () => {
    const event = makeEvent({
      ...validClassPayload,
      timeSlots: [{ startTime: "9am", endTime: "10am" }],
    });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(400);
  });

  // ── endsAt field handling ──

  it("creates class without endsAt when not provided", async () => {
    const mockResult = { id: "cls-1", ...validClassPayload };
    (prisma.classSession.create as jest.Mock).mockResolvedValue(mockResult);

    const event = makeEvent(validClassPayload);
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(200);

    const createArgs = (prisma.classSession.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.endsAt).toBeUndefined();
  });

  it("creates class with endsAt when provided", async () => {
    const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const payload = { ...validClassPayload, endsAt };
    const mockResult = { id: "cls-2", ...payload };
    (prisma.classSession.create as jest.Mock).mockResolvedValue(mockResult);

    const event = makeEvent(payload);
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(200);

    const createArgs = (prisma.classSession.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.endsAt).toBeInstanceOf(Date);
    expect(createArgs.data.endsAt.toISOString()).toBe(endsAt);
  });

  it("creates class with endsAt as null when explicitly set to null", async () => {
    const payload = { ...validClassPayload, endsAt: null };
    const mockResult = { id: "cls-3", ...payload };
    (prisma.classSession.create as jest.Mock).mockResolvedValue(mockResult);

    const event = makeEvent(payload);
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(200);

    const createArgs = (prisma.classSession.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.endsAt).toBeUndefined();
  });

  // ── Successful creation ──

  it("converts startsAt string to Date", async () => {
    const startsAt = new Date().toISOString();
    const mockResult = { id: "cls-4", ...validClassPayload, startsAt };
    (prisma.classSession.create as jest.Mock).mockResolvedValue(mockResult);

    const event = makeEvent({ ...validClassPayload, startsAt });
    await handler(event, {} as any);

    const createArgs = (prisma.classSession.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.startsAt).toBeInstanceOf(Date);
  });

  it("passes correct data structure to prisma.create", async () => {
    const endsAt = new Date(Date.now() + 86400000).toISOString();
    const payload = {
      ...validClassPayload,
      endsAt,
      instructor: "Guru Ji",
      location: "Studio A",
      isRecurring: true,
      recurrenceDays: [1, 3, 5],
      timeSlots: [{ startTime: "09:00", endTime: "10:00" }],
      pricingType: "PER_MONTH" as const,
    };
    (prisma.classSession.create as jest.Mock).mockResolvedValue({ id: "cls-5", ...payload });

    const event = makeEvent(payload);
    await handler(event, {} as any);

    const createArgs = (prisma.classSession.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.title).toBe("Morning Yoga");
    expect(createArgs.data.instructor).toBe("Guru Ji");
    expect(createArgs.data.location).toBe("Studio A");
    expect(createArgs.data.isRecurring).toBe(true);
    expect(createArgs.data.recurrenceDays).toEqual([1, 3, 5]);
    expect(createArgs.data.timeSlots).toEqual([{ startTime: "09:00", endTime: "10:00" }]);
    expect(createArgs.data.pricingType).toBe("PER_MONTH");
    expect(createArgs.data.endsAt).toBeInstanceOf(Date);
  });

  it("sets capacity to null when not provided", async () => {
    const { capacity, ...noCapacity } = validClassPayload;
    (prisma.classSession.create as jest.Mock).mockResolvedValue({ id: "cls-6" });

    const event = makeEvent(noCapacity);
    await handler(event, {} as any);

    const createArgs = (prisma.classSession.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.capacity).toBeNull();
  });

  it("defaults active to true when not provided", async () => {
    const { active, ...noActive } = validClassPayload;
    (prisma.classSession.create as jest.Mock).mockResolvedValue({ id: "cls-7" });

    const event = makeEvent(noActive);
    await handler(event, {} as any);

    const createArgs = (prisma.classSession.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.active).toBe(true);
  });

  // ── Error handling ──

  it("returns 500 when database throws", async () => {
    (prisma.classSession.create as jest.Mock).mockRejectedValue(new Error("DB error"));

    const event = makeEvent(validClassPayload);
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(500);

    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(false);
  });
});
