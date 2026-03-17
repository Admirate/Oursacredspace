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
  if (isRateLimited(`getClasses:${clientIP}`, RATE_LIMITS.PUBLIC_READ.maxRequests, RATE_LIMITS.PUBLIC_READ.windowMs)) {
    return rateLimitResponse();
  }

  try {
    const includeInactive = event.queryStringParameters?.includeInactive === "true";

    const classes = await prisma.classSession.findMany({
      where: includeInactive
        ? {}
        : {
            active: true,
            deletedAt: null,
            OR: [
              { isRecurring: true, OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
              { startsAt: { gte: new Date() } },
              { endsAt: { gte: new Date() } },
            ],
          },
      orderBy: { startsAt: "asc" },
      include: {
        _count: {
          select: {
            bookings: {
              where: {
                status: { in: ["CONFIRMED", "PENDING_PAYMENT"] },
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    const classesWithAvailability = classes.map((c) => {
      const bookedCount = c._count.bookings;
      const availableSpots = c.capacity !== null ? Math.max(0, c.capacity - bookedCount) : null;
      const { _count, ...rest } = c;
      return { ...rest, bookedCount, availableSpots };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: classesWithAvailability,
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Get classes error:", errorMessage);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch classes",
      }),
    };
  }
};
