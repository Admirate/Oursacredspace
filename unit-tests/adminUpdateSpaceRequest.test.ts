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

import { handler } from "../netlify/functions/adminUpdateSpaceRequest";
import { prisma } from "./__mocks__/prisma";
import { verifyAdminSession } from "../netlify/functions/helpers/verifyAdmin";

const makeEvent = (body: any, overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/adminUpdateSpaceRequest",
  rawQuery: "",
  path: "/.netlify/functions/adminUpdateSpaceRequest",
  httpMethod: "POST",
  headers: { origin: "http://localhost:3000" },
  multiValueHeaders: {},
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  body: JSON.stringify(body),
  isBase64Encoded: false,
  ...overrides,
});

describe("adminUpdateSpaceRequest handler", () => {
  beforeEach(() => jest.clearAllMocks());

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

    const event = makeEvent({ requestId: "req-1", status: "APPROVED" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(401);
  });

  it("returns 404 when space request not found", async () => {
    (prisma.spaceRequest.findUnique as jest.Mock).mockResolvedValue(null);

    const event = makeEvent({ requestId: "nonexistent-id-12345", status: "APPROVED" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(404);
  });

  it("approves a space request and syncs booking to PENDING_PAYMENT", async () => {
    const mockRequest = {
      id: "req-1",
      customerPhone: "+919876543210",
      adminNotes: null,
      booking: { id: "booking-1" },
    };
    (prisma.spaceRequest.findUnique as jest.Mock).mockResolvedValue(mockRequest);
    (prisma.spaceRequest.update as jest.Mock).mockResolvedValue({
      ...mockRequest,
      status: "APPROVED_CALL_SCHEDULED",
    });
    (prisma.booking.update as jest.Mock).mockResolvedValue({});
    (prisma.notificationLog.create as jest.Mock).mockResolvedValue({});

    const event = makeEvent({ requestId: "req-1", status: "APPROVED" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(200);

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: { status: "PENDING_PAYMENT" },
    });

    expect(prisma.notificationLog.create).toHaveBeenCalled();
  });

  it("declines a space request and syncs booking to DECLINED", async () => {
    const mockRequest = {
      id: "req-2",
      customerPhone: "+919876543210",
      adminNotes: null,
      booking: { id: "booking-2" },
    };
    (prisma.spaceRequest.findUnique as jest.Mock).mockResolvedValue(mockRequest);
    (prisma.spaceRequest.update as jest.Mock).mockResolvedValue({
      ...mockRequest,
      status: "DECLINED",
    });
    (prisma.booking.update as jest.Mock).mockResolvedValue({});

    const event = makeEvent({
      requestId: "req-2",
      status: "DECLINED",
      adminNotes: "Space unavailable",
    });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(200);

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-2" },
      data: { status: "DECLINED" },
    });
  });

  it("confirms a space request and syncs booking to CONFIRMED", async () => {
    const mockRequest = {
      id: "req-3",
      customerPhone: "+919876543210",
      adminNotes: null,
      booking: { id: "booking-3" },
    };
    (prisma.spaceRequest.findUnique as jest.Mock).mockResolvedValue(mockRequest);
    (prisma.spaceRequest.update as jest.Mock).mockResolvedValue({
      ...mockRequest,
      status: "CONFIRMED",
    });
    (prisma.booking.update as jest.Mock).mockResolvedValue({});

    const event = makeEvent({ requestId: "req-3", status: "CONFIRMED" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(200);

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-3" },
      data: { status: "CONFIRMED" },
    });
  });

  it("does not update booking when space request has no booking", async () => {
    const mockRequest = {
      id: "req-4",
      customerPhone: "+919876543210",
      adminNotes: null,
      booking: null,
    };
    (prisma.spaceRequest.findUnique as jest.Mock).mockResolvedValue(mockRequest);
    (prisma.spaceRequest.update as jest.Mock).mockResolvedValue({
      ...mockRequest,
      status: "DECLINED",
    });

    const event = makeEvent({ requestId: "req-4", status: "DECLINED" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(200);
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid status value", async () => {
    const event = makeEvent({ requestId: "req-5", status: "INVALID_STATUS" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(400);
  });
});
