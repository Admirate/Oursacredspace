import { Handler } from "@netlify/functions";
import { prisma } from "./helpers/prisma";
import { getClientIP, isRateLimited, rateLimitResponse, RATE_LIMITS, getPublicHeaders } from "./helpers/security";
import { occupiesSeatWhere } from "./helpers/bookingHold";

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
    // SECURITY (SEC-010): Public endpoints NEVER expose inactive or deleted
    // records. The previous `includeInactive` query param was removed because
    // it allowed unauthenticated callers to bypass all filters.
    const events = await prisma.event.findMany({
      where: {
        active: true,
        deletedAt: null,
        OR: [
          { startsAt: { gte: new Date() } },
          { endsAt: { gte: new Date() } },
        ],
      },
      orderBy: { startsAt: "asc" },
      take: 100,
    });

    // Multi-seat aware: booked = SUM(quantity) of active bookings per event,
    // not a row count. One booking may hold several passes.
    //
    // Unpaid bookings only count while inside their hold window — otherwise an
    // abandoned checkout would show the event as sold out forever.
    const grouped = await prisma.booking.groupBy({
      by: ["eventId"],
      where: {
        eventId: { in: events.map((e) => e.id) },
        ...occupiesSeatWhere(),
      },
      _sum: { quantity: true },
    });
    const bookedByEvent = new Map(
      grouped.map((g) => [g.eventId, g._sum.quantity ?? 0])
    );

    const eventsWithAvailability = events.map((e) => {
      const bookedCount = bookedByEvent.get(e.id) ?? 0;
      const availableSpots = e.capacity !== null ? Math.max(0, e.capacity - bookedCount) : null;
      return { ...e, bookedCount, availableSpots };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: eventsWithAvailability,
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
