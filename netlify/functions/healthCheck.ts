import { Handler } from "@netlify/functions";
import { prisma } from "./helpers/prisma";
import { logger } from "./helpers/logger";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
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

  const body = JSON.stringify({
    status: allOk ? "ok" : "degraded",
    checks,
    latencyMs: Date.now() - start,
    timestamp: new Date().toISOString(),
  });

  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body,
  };
};
