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
    // SECURITY (SEC-010): Public endpoints NEVER expose inactive or deleted
    // records. The previous `includeInactive` query param was removed because
    // it allowed unauthenticated callers to bypass all filters.
    const classes = await prisma.classSession.findMany({
      where: {
        active: true,
        deletedAt: null,
        OR: [
          { isRecurring: true, OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
          { startsAt: { gte: new Date() } },
          { endsAt: { gte: new Date() } },
        ],
      },
      orderBy: { startsAt: "asc" },
      take: 100,
    });

    // Multi-seat aware: booked = SUM(quantity) of active bookings per class,
    // not a row count. One booking may hold several seats.
    const grouped = await prisma.booking.groupBy({
      by: ["classSessionId"],
      where: {
        classSessionId: { in: classes.map((c) => c.id) },
        status: { in: ["CONFIRMED", "PENDING_PAYMENT"] },
        deletedAt: null,
      },
      _sum: { quantity: true },
    });
    const bookedByClass = new Map(
      grouped.map((g) => [g.classSessionId, g._sum.quantity ?? 0])
    );

    const classesWithAvailability = classes.map((c) => {
      const bookedCount = bookedByClass.get(c.id) ?? 0;
      const availableSpots = c.capacity !== null ? Math.max(0, c.capacity - bookedCount) : null;
      return { ...c, bookedCount, availableSpots };
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
