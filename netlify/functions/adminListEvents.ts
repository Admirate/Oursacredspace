import { Handler } from "@netlify/functions";
import { prisma } from "./helpers/prisma";
import { verifyAdminSession, unauthorizedResponse, getAdminHeaders } from "./helpers/verifyAdmin";
import { getClientIP, isRateLimited, rateLimitResponse, RATE_LIMITS } from "./helpers/security";
import { occupiesSeatWhere } from "./helpers/bookingHold";

export const handler: Handler = async (event) => {
  const headers = getAdminHeaders(event);

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

  // SECURITY (SEC-030): Rate limit before auth. This endpoint also performs an
  // updateMany write on every GET, so throttling caps write load from a valid
  // (or hijacked) session hammering the list view.
  const clientIP = getClientIP(event);
  if (isRateLimited(`admin:listEvents:${clientIP}`, RATE_LIMITS.ADMIN_READ.maxRequests, RATE_LIMITS.ADMIN_READ.windowMs)) {
    return rateLimitResponse();
  }

  // Verify admin session
  const authResult = await verifyAdminSession(event);
  if (!authResult.isValid) {
    return unauthorizedResponse(event, authResult.error);
  }

  try {
    const now = new Date();

    const rawPage = parseInt(event.queryStringParameters?.page || "1", 10);
    const rawLimit = parseInt(event.queryStringParameters?.limit || "50", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limit = Math.min(100, isNaN(rawLimit) || rawLimit < 1 ? 50 : rawLimit);

    // Auto-deactivate events whose time has passed
    await prisma.event.updateMany({
      where: {
        active: true,
        deletedAt: null,
        startsAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
      data: { active: false },
    });

    const total = await prisma.event.count({ where: { deletedAt: null } });

    const events = await prisma.event.findMany({
      where: { deletedAt: null },
      orderBy: { startsAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        venue: true,
        startsAt: true,
        endsAt: true,
        pricePaise: true,
        capacity: true,
        active: true,
        createdAt: true,
      },
    });

    // Derived occupancy: SUM(quantity) of seat-occupying bookings (CONFIRMED +
    // unexpired PENDING holds), multi-seat aware. Mirrors getEvents so the true
    // pass count is reported — not an unfiltered booking row count.
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

    const eventsWithStats = events.map((event) => {
      const endTime = event.endsAt || event.startsAt;
      const bookedCount = bookedByEvent.get(event.id) ?? 0;
      const availableSpots =
        event.capacity !== null ? Math.max(0, event.capacity - bookedCount) : null;

      return {
        ...event,
        bookedCount,
        availableSpots,
        isExpired: endTime < now,
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: eventsWithStats,
        pagination: { total, page, limit: limit || total, hasMore: limit > 0 ? page * limit < total : false },
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("List events error:", errorMessage);
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
