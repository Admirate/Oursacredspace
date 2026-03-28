import { HandlerEvent } from "@netlify/functions";

jest.mock("../netlify/functions/helpers/prisma", () =>
  require("./__mocks__/prisma")
);
jest.mock("bcryptjs", () => ({
  compare: jest.fn().mockImplementation((plain: string, _hash: string) =>
    Promise.resolve(plain === "testpassword123")
  ),
  hash: jest.fn().mockResolvedValue("$2a$12$hashedvalue"),
}));

import { handler } from "../netlify/functions/adminAuth";
import { prisma } from "./__mocks__/prisma";

const makeEvent = (overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  rawUrl: "http://localhost:8888/.netlify/functions/adminAuth",
  rawQuery: "",
  path: "/.netlify/functions/adminAuth",
  httpMethod: "POST",
  headers: {
    origin: "http://localhost:3000",
  },
  multiValueHeaders: {},
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  body: null,
  isBase64Encoded: false,
  ...overrides,
});

describe("adminAuth handler", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      ADMIN_ALLOWED_EMAILS: "admin@test.com,superadmin@test.com",
      ADMIN_PASSWORD_HASH: "$2a$12$hashedvalue",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ── OPTIONS ──

  it("returns 204 for OPTIONS preflight", async () => {
    const event = makeEvent({ httpMethod: "OPTIONS" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(204);
  });

  // ── POST (Login) ──

  it("returns 401 for disallowed email", async () => {
    const event = makeEvent({
      body: JSON.stringify({ email: "hacker@evil.com", password: "testpassword123" }),
    });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(401);
    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Invalid credentials");
  });

  it("returns 401 for wrong password", async () => {
    const event = makeEvent({
      body: JSON.stringify({ email: "admin@test.com", password: "wrongpassword" }),
    });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(401);
  });

  it("returns 200 with Set-Cookie on successful login", async () => {
    (prisma.adminSession.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.adminSession.create as jest.Mock).mockResolvedValue({
      id: "session-1",
      email: "admin@test.com",
      token: "abc123",
      expiresAt: new Date(Date.now() + 86400000),
    });

    const event = makeEvent({
      body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
    });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(200);
    const body = JSON.parse(response!.body!);
    expect(body.success).toBe(true);
    expect(body.data.email).toBe("admin@test.com");
    const cookies = response!.multiValueHeaders!["Set-Cookie"] as string[];
    expect(cookies).toBeDefined();
    expect(cookies.join(";")).toContain("admin_token=");
    expect(cookies.join(";")).toContain("HttpOnly");
    expect(cookies.join(";")).toContain("SameSite=Strict");
  });

  it("deletes previous sessions on login", async () => {
    (prisma.adminSession.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.adminSession.create as jest.Mock).mockResolvedValue({
      id: "session-2",
      email: "admin@test.com",
      token: "def456",
      expiresAt: new Date(Date.now() + 86400000),
    });

    const event = makeEvent({
      body: JSON.stringify({ email: "admin@test.com", password: "testpassword123" }),
    });
    await handler(event, {} as any);
    expect(prisma.adminSession.deleteMany).toHaveBeenCalledWith({
      where: { email: "admin@test.com" },
    });
  });

  it("returns 400 for invalid body (Zod validation)", async () => {
    const event = makeEvent({
      body: JSON.stringify({ email: "not-email", password: "" }),
    });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(400);
    const body = JSON.parse(response!.body!);
    expect(body.error).toContain("Invalid");
  });

  // ── GET (Session check) ──

  it("returns 401 when no token cookie is present", async () => {
    const event = makeEvent({ httpMethod: "GET" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(401);
  });

  it("returns 200 for valid session", async () => {
    (prisma.adminSession.findUnique as jest.Mock).mockResolvedValue({
      email: "admin@test.com",
      token: "a".repeat(64),
      expiresAt: new Date(Date.now() + 86400000),
    });

    const event = makeEvent({
      httpMethod: "GET",
      headers: {
        cookie: `admin_token=${"a".repeat(64)}`,
        origin: "http://localhost:3000",
      },
    });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(200);
    const body = JSON.parse(response!.body!);
    expect(body.data.email).toBe("admin@test.com");
  });

  it("returns 401 for expired session", async () => {
    (prisma.adminSession.findUnique as jest.Mock).mockResolvedValue({
      email: "admin@test.com",
      token: "b".repeat(64),
      expiresAt: new Date(Date.now() - 1000),
    });

    const event = makeEvent({
      httpMethod: "GET",
      headers: {
        cookie: `admin_token=${"b".repeat(64)}`,
        origin: "http://localhost:3000",
      },
    });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(401);
  });

  // ── DELETE (Logout) ──

  it("clears the cookie on logout", async () => {
    (prisma.adminSession.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

    const event = makeEvent({
      httpMethod: "DELETE",
      headers: {
        cookie: `admin_token=${"c".repeat(64)}`,
        origin: "http://localhost:3000",
      },
    });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(200);
    const cookies = response!.multiValueHeaders!["Set-Cookie"] as string[];
    expect(cookies.join(";")).toContain("Max-Age=0");
  });

  // ── 405 ──

  it("returns 405 for unsupported methods", async () => {
    const event = makeEvent({ httpMethod: "PUT" });
    const response = await handler(event, {} as any);
    expect(response!.statusCode).toBe(405);
  });
});
