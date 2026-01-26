import { Handler } from "@netlify/functions";
import { prisma } from "./helpers/prisma";
import { getClientIP, isRateLimited, rateLimitResponse, RATE_LIMITS, getPublicHeaders } from "./helpers/security";

export const handler: Handler = async (event) => {
  // SECURITY: Use origin-validated CORS headers
  const headers = getPublicHeaders(event, "GET, OPTIONS");

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: "Method not allowed" }),
    };
  }

  // SECURITY: Rate limit public read endpoint
  const clientIP = getClientIP(event);
  if (isRateLimited(`getEvents:${clientIP}`, RATE_LIMITS.PUBLIC_READ.maxRequests, RATE_LIMITS.PUBLIC_READ.windowMs)) {
    return rateLimitResponse();
  }

  try {
    const includeInactive = event.queryStringParameters?.includeInactive === "true";

    const events = await prisma.event.findMany({
      where: includeInactive
        ? {}
        : {
            active: true,
            startsAt: { gte: new Date() }, // Only future events
          },
      orderBy: { startsAt: "asc" },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: events,
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Get events error:", errorMessage);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch events",
      }),
    };
  }
};
