jest.mock("../netlify/functions/helpers/prisma", () =>
  require("./__mocks__/prisma")
);

import { verifyAdminSession } from "../netlify/functions/helpers/verifyAdmin";
import { prisma } from "./__mocks__/prisma";
import { HandlerEvent } from "@netlify/functions";

const makeEvent = (cookie?: string): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/test",
  rawQuery: "",
  path: "/.netlify/functions/test",
  httpMethod: "GET",
  headers: cookie ? { cookie } : {},
  multiValueHeaders: {},
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  body: null,
  isBase64Encoded: false,
});

describe("verifyAdminSession", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns invalid when no cookie header is present", async () => {
    const result = await verifyAdminSession(makeEvent());
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Not authenticated");
  });

  it("returns invalid when cookie has no admin_token", async () => {
    const result = await verifyAdminSession(makeEvent("session_id=abc123"));
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Not authenticated");
  });

  it("returns invalid when token format is wrong (not 64 hex chars)", async () => {
    const result = await verifyAdminSession(makeEvent("admin_token=short"));
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Not authenticated");
  });

  it("returns invalid when session not found in database", async () => {
    const token = "a".repeat(64);
    (prisma.adminSession.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await verifyAdminSession(makeEvent(`admin_token=${token}`));
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Invalid session");
  });

  it("returns invalid and cleans up when session is expired", async () => {
    const token = "b".repeat(64);
    (prisma.adminSession.findUnique as jest.Mock).mockResolvedValue({
      token,
      email: "admin@test.com",
      expiresAt: new Date(Date.now() - 1000),
    });
    (prisma.adminSession.delete as jest.Mock).mockResolvedValue({});

    const result = await verifyAdminSession(makeEvent(`admin_token=${token}`));
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Session expired");
    expect(prisma.adminSession.delete).toHaveBeenCalledWith({
      where: { token },
    });
  });

  it("returns valid with email for active session", async () => {
    const token = "c".repeat(64);
    (prisma.adminSession.findUnique as jest.Mock).mockResolvedValue({
      token,
      email: "admin@test.com",
      expiresAt: new Date(Date.now() + 86400000),
    });

    const result = await verifyAdminSession(makeEvent(`admin_token=${token}`));
    expect(result.isValid).toBe(true);
    expect(result.email).toBe("admin@test.com");
  });

  it("handles multiple cookies correctly", async () => {
    const token = "d".repeat(64);
    (prisma.adminSession.findUnique as jest.Mock).mockResolvedValue({
      token,
      email: "admin@test.com",
      expiresAt: new Date(Date.now() + 86400000),
    });

    const cookie = `other_cookie=value; admin_token=${token}; another=thing`;
    const result = await verifyAdminSession(makeEvent(cookie));
    expect(result.isValid).toBe(true);
  });

  it("returns invalid when database throws", async () => {
    const token = "e".repeat(64);
    (prisma.adminSession.findUnique as jest.Mock).mockRejectedValue(
      new Error("DB connection failed")
    );

    const result = await verifyAdminSession(makeEvent(`admin_token=${token}`));
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Authentication failed");
  });
});
