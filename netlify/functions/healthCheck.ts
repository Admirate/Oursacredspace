import { Handler } from "@netlify/functions";
import { prisma } from "./helpers/prisma";
import { logger } from "./helpers/logger";
import { hashToken, getClientIP, isRateLimited, rateLimitResponse } from "./helpers/security";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  // SECURITY (SEC-031): Throttle the unauthenticated health probe. Each call
  // runs a `SELECT 1` against Postgres; without a cap an anonymous caller can
  // use it as a cheap DB-load amplifier. 30/min per IP is ample for real
  // uptime monitors while blunting abuse. (In-memory is acceptable here — the
  // endpoint touches no sensitive state and we don't want a health check to
  // add DB writes of its own.)
  const clientIP = getClientIP(event);
  if (isRateLimited(`healthCheck:${clientIP}`, 30, 60000)) {
    return rateLimitResponse();
  }

  const start = Date.now();
  const checks: Record<string, "ok" | "error"> = {};

  // DB connectivity check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch (error) {
    checks.database = "error";
    logger.error("Health check: DB unreachable", error);
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  const statusCode = allOk ? 200 : 503;
  const responseHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };

  // SECURITY (SEC-028): Only authenticated admins see internal diagnostics.
  // Unauthenticated callers get a bare status code with no detail.
  const adminToken = event.headers.cookie
    ?.split(";")
    .find((c) => c.trim().startsWith("admin_token="))
    ?.split("=")[1];

  let isAdmin = false;
  if (adminToken && /^[a-f0-9]{64}$/i.test(adminToken)) {
    const hashed = hashToken(adminToken);
    const session = await prisma.adminSession.findUnique({
      where: { hashedToken: hashed },
      select: { expiresAt: true },
    });
    isAdmin = !!session && session.expiresAt > new Date();
  }

  if (isAdmin) {
    return {
      statusCode,
      headers: responseHeaders,
      body: JSON.stringify({
        status: allOk ? "ok" : "degraded",
        checks,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      }),
    };
  }

  return {
    statusCode,
    headers: responseHeaders,
    body: JSON.stringify({ status: allOk ? "ok" : "degraded" }),
  };
};
