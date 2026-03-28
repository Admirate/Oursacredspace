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

import { handler } from "../netlify/functions/adminDeleteEvent";
import { prisma } from "./__mocks__/prisma";
import { verifyAdminSession } from "../netlify/functions/helpers/verifyAdmin";

const makeEvent = (overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/adminDeleteEvent",
  rawQuery: "",
  path: "/.netlify/functions/adminDeleteEvent",
  httpMethod: "DELETE",
  headers: { origin: "http://localhost:3000" },
  multiValueHeaders: {},
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  body: null,
  isBase64Encoded: false,
  ...overrides,
});

const existingEvent = {
  id: "evt-abc123",
  title: "Open Mic Night",
  active: true,
  deletedAt: null,
};

describe("adminDeleteEvent handler", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── HTTP method guards ──

  it("returns 204 for OPTIONS preflight", async () => {
    const response = await handler(makeEvent({ httpMethod: "OPTIONS" }), {} as any);
    expect(response!.statusCode).toBe(204);
  });

  it("returns 405 for GET", async () => {
    const response = await handler(makeEvent({ httpMethod: "GET" }), {} as any);
    expect(response!.statusCode).toBe(405);
    const body = JSON.parse(response!.body!);
    expect(body.error).toBe("Method not allowed");
  });

  it("returns 405 for POST", async () => {
    const response = await handler(makeEvent({ httpMethod: "POST" }), {} as any);
    expect(response!.statusCode).toBe(405);
  });

  // ── Auth ──

  it("returns 401 when session is invalid", async () => {
    (verifyAdminSession as jest.Mock).mockResolvedValueOnce({ isValid: false, error: "Expired" });
    const response = await handler(makeEvent({ body: JSON.stringify({ id: "evt-1" }) }), {} as any);
    expect(response!.statusCode).toBe(401);
  });

  // ── Validation ──

  it("returns 400 when body is missing id", async () => {
    const response = await handler(makeEvent({ body: JSON.stringify({}) }), {} as any);
    expect(response!.statusCode).toBe(400);
    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(false);
  });

  it("returns 400 when id is empty string", async () => {
    const response = await handler(makeEvent({ body: JSON.stringify({ id: "" }) }), {} as any);
    expect(response!.statusCode).toBe(400);
  });

  it("returns 400 when id exceeds 30 chars", async () => {
    const response = await handler(
      makeEvent({ body: JSON.stringify({ id: "x".repeat(31) }) }),
      {} as any
    );
    expect(response!.statusCode).toBe(400);
  });

  // ── Not found ──

  it("returns 404 when event does not exist", async () => {
    (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);
    const response = await handler(
      makeEvent({ body: JSON.stringify({ id: "evt-missing" }) }),
      {} as any
    );
    expect(response!.statusCode).toBe(404);
    const body = JSON.parse(response!.body!);
    expect(body.error).toBe("Event not found");
  });

  // ── Successful soft delete ──

  it("returns 200 and soft-deletes the event", async () => {
    (prisma.event.findUnique as jest.Mock).mockResolvedValue(existingEvent);
    (prisma.event.update as jest.Mock).mockResolvedValue({
      ...existingEvent,
      active: false,
      deletedAt: new Date(),
    });

    const response = await handler(
      makeEvent({ body: JSON.stringify({ id: "evt-abc123" }) }),
      {} as any
    );

    expect(response!.statusCode).toBe(200);
    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(true);
  });

  it("calls event.update with deletedAt and active:false", async () => {
    (prisma.event.findUnique as jest.Mock).mockResolvedValue(existingEvent);
    (prisma.event.update as jest.Mock).mockResolvedValue({});

    await handler(makeEvent({ body: JSON.stringify({ id: "evt-abc123" }) }), {} as any);

    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: "evt-abc123" },
      data: {
        deletedAt: expect.any(Date),
        active: false,
      },
    });
  });

  it("calls event.findUnique before update to confirm existence", async () => {
    (prisma.event.findUnique as jest.Mock).mockResolvedValue(existingEvent);
    (prisma.event.update as jest.Mock).mockResolvedValue({});

    await handler(makeEvent({ body: JSON.stringify({ id: "evt-abc123" }) }), {} as any);

    expect(prisma.event.findUnique).toHaveBeenCalledWith({ where: { id: "evt-abc123" } });
    expect(prisma.event.update).toHaveBeenCalledTimes(1);
  });

  it("does not call event.update if findUnique returns null", async () => {
    (prisma.event.findUnique as jest.Mock).mockResolvedValue(null);

    await handler(makeEvent({ body: JSON.stringify({ id: "evt-abc123" }) }), {} as any);

    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  // ── DB error ──

  it("returns 500 when database throws on update", async () => {
    (prisma.event.findUnique as jest.Mock).mockResolvedValue(existingEvent);
    (prisma.event.update as jest.Mock).mockRejectedValue(new Error("Connection lost"));

    const response = await handler(
      makeEvent({ body: JSON.stringify({ id: "evt-abc123" }) }),
      {} as any
    );

    expect(response!.statusCode).toBe(500);
    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Failed to delete event");
  });

  it("returns 500 when database throws on findUnique", async () => {
    (prisma.event.findUnique as jest.Mock).mockRejectedValue(new Error("Timeout"));

    const response = await handler(
      makeEvent({ body: JSON.stringify({ id: "evt-abc123" }) }),
      {} as any
    );

    expect(response!.statusCode).toBe(500);
    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(false);
  });
});
