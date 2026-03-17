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
  CheckInStatus: { NOT_CHECKED_IN: "NOT_CHECKED_IN", CHECKED_IN: "CHECKED_IN" },
}));

import { handler } from "../netlify/functions/adminCheckinPass";
import { prisma } from "./__mocks__/prisma";
import { verifyAdminSession } from "../netlify/functions/helpers/verifyAdmin";

const makeEvent = (body: any, overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/adminCheckinPass",
  rawQuery: "", path: "/.netlify/functions/adminCheckinPass",
  httpMethod: "POST",
  headers: { origin: "http://localhost:3000" },
  multiValueHeaders: {}, queryStringParameters: null,
  multiValueQueryStringParameters: null,
  body: JSON.stringify(body), isBase64Encoded: false,
  ...overrides,
});

const mockPass = {
  id: "pass-db-1",
  passId: "OSS-EV-ABCD1234",
  checkInStatus: "NOT_CHECKED_IN",
  checkInTime: null,
  event: { title: "Open Mic" },
  booking: { customerName: "John Doe", status: "CONFIRMED" },
};

describe("adminCheckinPass handler", () => {
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
    const res = await handler(makeEvent({ passId: "OSS-EV-ABCD1234" }), {} as any);
    expect(res!.statusCode).toBe(401);
  });

  // ── Validation ──

  it("returns 400 for invalid passId format (lowercase)", async () => {
    const res = await handler(makeEvent({ passId: "oss-ev-abcd1234" }), {} as any);
    expect(res!.statusCode).toBe(400);
  });

  it("returns 400 for invalid passId format (wrong prefix)", async () => {
    const res = await handler(makeEvent({ passId: "TICKET-12345678" }), {} as any);
    expect(res!.statusCode).toBe(400);
  });

  it("returns 400 for missing passId", async () => {
    const res = await handler(makeEvent({}), {} as any);
    expect(res!.statusCode).toBe(400);
  });

  it("returns 400 for passId with wrong length", async () => {
    const res = await handler(makeEvent({ passId: "OSS-EV-ABC" }), {} as any);
    expect(res!.statusCode).toBe(400);
  });

  // ── Pass not found ──

  it("returns 404 when pass not found", async () => {
    (prisma.eventPass.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await handler(makeEvent({ passId: "OSS-EV-ABCD1234" }), {} as any);
    expect(res!.statusCode).toBe(404);
    expect(JSON.parse(res!.body!).error).toBe("Pass not found");
  });

  // ── Booking not confirmed ──

  it("returns 400 when booking is not confirmed", async () => {
    (prisma.eventPass.findUnique as jest.Mock).mockResolvedValue({
      ...mockPass,
      booking: { customerName: "Jane", status: "PENDING_PAYMENT" },
    });
    const res = await handler(makeEvent({ passId: "OSS-EV-ABCD1234" }), {} as any);
    expect(res!.statusCode).toBe(400);
    expect(JSON.parse(res!.body!).error).toContain("PENDING_PAYMENT");
  });

  it("returns 400 when booking is cancelled", async () => {
    (prisma.eventPass.findUnique as jest.Mock).mockResolvedValue({
      ...mockPass,
      booking: { customerName: "Jane", status: "CANCELLED" },
    });
    const res = await handler(makeEvent({ passId: "OSS-EV-ABCD1234" }), {} as any);
    expect(res!.statusCode).toBe(400);
  });

  // ── Already checked in ──

  it("returns 200 with alreadyCheckedIn=true when already checked in", async () => {
    const checkInTime = new Date(Date.now() - 60000);
    (prisma.eventPass.findUnique as jest.Mock).mockResolvedValue({
      ...mockPass,
      checkInStatus: "CHECKED_IN",
      checkInTime,
    });

    const res = await handler(makeEvent({ passId: "OSS-EV-ABCD1234" }), {} as any);
    expect(res!.statusCode).toBe(200);
    const body = JSON.parse(res!.body!);
    expect(body.data.alreadyCheckedIn).toBe(true);
    expect(body.data.attendeeName).toBe("John Doe");
    expect(body.data.eventTitle).toBe("Open Mic");
    expect(prisma.eventPass.update).not.toHaveBeenCalled();
  });

  // ── Successful check-in ──

  it("checks in pass and returns attendee info", async () => {
    (prisma.eventPass.findUnique as jest.Mock).mockResolvedValue(mockPass);
    (prisma.eventPass.update as jest.Mock).mockResolvedValue({});

    const res = await handler(makeEvent({ passId: "OSS-EV-ABCD1234" }), {} as any);
    expect(res!.statusCode).toBe(200);
    const body = JSON.parse(res!.body!);
    expect(body.data.alreadyCheckedIn).toBe(false);
    expect(body.data.passId).toBe("OSS-EV-ABCD1234");
    expect(body.data.attendeeName).toBe("John Doe");
    expect(body.data.eventTitle).toBe("Open Mic");
    expect(body.data.checkInTime).toBeDefined();
  });

  it("calls prisma.eventPass.update with correct data", async () => {
    (prisma.eventPass.findUnique as jest.Mock).mockResolvedValue(mockPass);
    (prisma.eventPass.update as jest.Mock).mockResolvedValue({});

    await handler(makeEvent({ passId: "OSS-EV-ABCD1234" }), {} as any);

    expect(prisma.eventPass.update).toHaveBeenCalledWith({
      where: { passId: "OSS-EV-ABCD1234" },
      data: {
        checkInStatus: "CHECKED_IN",
        checkInTime: expect.any(Date),
        checkedInBy: "admin@test.com",
      },
    });
  });

  // ── Error handling ──

  it("returns 500 when database throws", async () => {
    (prisma.eventPass.findUnique as jest.Mock).mockRejectedValue(new Error("DB down"));
    const res = await handler(makeEvent({ passId: "OSS-EV-ABCD1234" }), {} as any);
    expect(res!.statusCode).toBe(500);
    expect(JSON.parse(res!.body!).success).toBe(false);
  });
});
