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

import { handler } from "../netlify/functions/adminCreateEvent";
import { prisma } from "./__mocks__/prisma";
import { verifyAdminSession } from "../netlify/functions/helpers/verifyAdmin";

const makeEvent = (body: any, overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/adminCreateEvent",
  rawQuery: "", path: "/.netlify/functions/adminCreateEvent",
  httpMethod: "POST",
  headers: { origin: "http://localhost:3000" },
  multiValueHeaders: {}, queryStringParameters: null,
  multiValueQueryStringParameters: null,
  body: JSON.stringify(body), isBase64Encoded: false,
  ...overrides,
});

const validPayload = {
  title: "Open Mic Night",
  startsAt: new Date().toISOString(),
  venue: "Main Hall",
  pricePaise: 50000,
  capacity: 100,
};

describe("adminCreateEvent handler", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 204 for OPTIONS", async () => {
    const res = await handler(makeEvent({}, { httpMethod: "OPTIONS", body: null }), {} as any);
    expect(res!.statusCode).toBe(204);
  });

  it("returns 405 for GET", async () => {
    const res = await handler(makeEvent({}, { httpMethod: "GET", body: null }), {} as any);
    expect(res!.statusCode).toBe(405);
  });

  it("returns 401 when admin session is invalid", async () => {
    (verifyAdminSession as jest.Mock).mockResolvedValueOnce({ isValid: false, error: "Nope" });
    const res = await handler(makeEvent(validPayload), {} as any);
    expect(res!.statusCode).toBe(401);
  });

  // ── Validation ──

  it("returns 400 for missing title", async () => {
    const { title, ...noTitle } = validPayload;
    const res = await handler(makeEvent(noTitle), {} as any);
    expect(res!.statusCode).toBe(400);
  });

  it("returns 400 for title too short", async () => {
    const res = await handler(makeEvent({ ...validPayload, title: "X" }), {} as any);
    expect(res!.statusCode).toBe(400);
  });

  it("returns 400 for missing venue", async () => {
    const { venue, ...noVenue } = validPayload;
    const res = await handler(makeEvent(noVenue), {} as any);
    expect(res!.statusCode).toBe(400);
  });

  it("returns 400 for negative price", async () => {
    const res = await handler(makeEvent({ ...validPayload, pricePaise: -1 }), {} as any);
    expect(res!.statusCode).toBe(400);
  });

  it("returns 400 for capacity below 1", async () => {
    const res = await handler(makeEvent({ ...validPayload, capacity: 0 }), {} as any);
    expect(res!.statusCode).toBe(400);
  });

  // ── endsAt handling ──

  it("creates event without endsAt when not provided", async () => {
    (prisma.event.create as jest.Mock).mockResolvedValue({ id: "evt-1", ...validPayload });
    const res = await handler(makeEvent(validPayload), {} as any);
    expect(res!.statusCode).toBe(200);

    const args = (prisma.event.create as jest.Mock).mock.calls[0][0];
    expect(args.data.endsAt).toBeUndefined();
  });

  it("creates event with endsAt when provided", async () => {
    const endsAt = new Date(Date.now() + 86400000).toISOString();
    const payload = { ...validPayload, endsAt };
    (prisma.event.create as jest.Mock).mockResolvedValue({ id: "evt-2", ...payload });

    const res = await handler(makeEvent(payload), {} as any);
    expect(res!.statusCode).toBe(200);

    const args = (prisma.event.create as jest.Mock).mock.calls[0][0];
    expect(args.data.endsAt).toBeInstanceOf(Date);
    expect(args.data.endsAt.toISOString()).toBe(endsAt);
  });

  it("creates event with endsAt undefined when null is passed", async () => {
    const payload = { ...validPayload, endsAt: null };
    (prisma.event.create as jest.Mock).mockResolvedValue({ id: "evt-3" });

    await handler(makeEvent(payload), {} as any);
    const args = (prisma.event.create as jest.Mock).mock.calls[0][0];
    expect(args.data.endsAt).toBeUndefined();
  });

  // ── Successful creation ──

  it("converts startsAt string to Date", async () => {
    (prisma.event.create as jest.Mock).mockResolvedValue({ id: "evt-4" });
    await handler(makeEvent(validPayload), {} as any);
    const args = (prisma.event.create as jest.Mock).mock.calls[0][0];
    expect(args.data.startsAt).toBeInstanceOf(Date);
  });

  it("passes all fields correctly to prisma.create", async () => {
    const payload = {
      ...validPayload,
      description: "A fun night",
      imageUrl: "https://example.com/img.png",
      active: true,
    };
    (prisma.event.create as jest.Mock).mockResolvedValue({ id: "evt-5", ...payload });

    await handler(makeEvent(payload), {} as any);
    const args = (prisma.event.create as jest.Mock).mock.calls[0][0];
    expect(args.data.title).toBe("Open Mic Night");
    expect(args.data.venue).toBe("Main Hall");
    expect(args.data.pricePaise).toBe(50000);
    expect(args.data.description).toBe("A fun night");
    expect(args.data.imageUrl).toBe("https://example.com/img.png");
  });

  it("defaults active to true when not provided", async () => {
    (prisma.event.create as jest.Mock).mockResolvedValue({ id: "evt-6" });
    await handler(makeEvent(validPayload), {} as any);
    const args = (prisma.event.create as jest.Mock).mock.calls[0][0];
    expect(args.data.active).toBe(true);
  });

  // ── Error handling ──

  it("returns 500 when database throws", async () => {
    (prisma.event.create as jest.Mock).mockRejectedValue(new Error("DB error"));
    const res = await handler(makeEvent(validPayload), {} as any);
    expect(res!.statusCode).toBe(500);
    expect(JSON.parse(res!.body!).success).toBe(false);
  });
});
