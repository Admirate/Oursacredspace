import { Handler } from "@netlify/functions";
import { prisma } from "./helpers/prisma";
import { verifyAdminSession, unauthorizedResponse, getAdminHeaders } from "./helpers/verifyAdmin";
import { getClientIP, isRateLimited, rateLimitResponse, RATE_LIMITS } from "./helpers/security";

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

  // SECURITY (SEC-030): Rate limit before auth. This endpoint also performs
  // updateMany writes on every GET, so throttling caps write load from a
  // valid (or hijacked) session hammering the list view.
  const clientIP = getClientIP(event);
  if (isRateLimited(`admin:listClasses:${clientIP}`, RATE_LIMITS.ADMIN_READ.maxRequests, RATE_LIMITS.ADMIN_READ.windowMs)) {
    return rateLimitResponse();
  }

  // Verify admin session
  const authResult = await verifyAdminSession(event);
  if (!authResult.isValid) {
    return unauthorizedResponse(event, authResult.error);
  }

  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const rawPage = parseInt(event.queryStringParameters?.page || "1", 10);
    const rawLimit = parseInt(event.queryStringParameters?.limit || "50", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limit = Math.min(100, isNaN(rawLimit) || rawLimit < 1 ? 50 : rawLimit);

    // Auto-deactivate non-recurring classes whose time has passed,
    // but only if they have NO endsAt set (or endsAt has also passed).
    await prisma.classSession.updateMany({
      where: {
        active: true,
        deletedAt: null,
        isRecurring: false,
        startsAt: { lt: oneDayAgo },
        OR: [
          { endsAt: null },
          { endsAt: { lt: now } },
        ],
      },
      data: { active: false },
    });

    // Auto-deactivate recurring classes only when endsAt is set and has passed
    await prisma.classSession.updateMany({
      where: {
        active: true,
        deletedAt: null,
        isRecurring: true,
        endsAt: { not: null, lt: now },
      },
      data: { active: false },
    });

    const total = await prisma.classSession.count({ where: { deletedAt: null } });

    const classes = await prisma.classSession.findMany({
      where: { deletedAt: null },
      orderBy: { startsAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        instructor: true,
        location: true,
        startsAt: true,
        endsAt: true,
        duration: true,
        capacity: true,
        isRecurring: true,
        recurrenceDays: true,
        timeSlots: true,
        pricingType: true,
        pricePaise: true,
        active: true,
        createdAt: true,
        _count: { select: { bookings: true } },
      },
    });

    const classesWithExpiry = classes.map((c) => {
      const endTime = c.endsAt || new Date(c.startsAt.getTime() + c.duration * 60 * 1000);
      return { ...c, isExpired: endTime < now };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: classesWithExpiry,
        pagination: { total, page, limit: limit || total, hasMore: limit > 0 ? page * limit < total : false },
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("List classes error:", errorMessage);
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
