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

  const clientIP = getClientIP(event);
  if (isRateLimited(`admin:stats:${clientIP}`, RATE_LIMITS.ADMIN_READ.maxRequests, RATE_LIMITS.ADMIN_READ.windowMs)) {
    return rateLimitResponse();
  }

  const authResult = await verifyAdminSession(event);
  if (!authResult.isValid) {
    return unauthorizedResponse(event, authResult.error);
  }

  try {
    const [
      totalBookings,
      confirmedBookings,
      pendingBookings,
      revenueResult,
      totalClasses,
      activeClasses,
      totalEvents,
      activeEvents,
      pendingSpaceRequests,
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({ where: { status: "CONFIRMED" } }),
      prisma.booking.count({ where: { status: "PENDING_PAYMENT" } }),
      prisma.booking.aggregate({
        where: { status: "CONFIRMED" },
        _sum: { amountPaise: true },
      }),
      prisma.classSession.count({ where: { deletedAt: null } }),
      prisma.classSession.count({ where: { active: true, deletedAt: null } }),
      prisma.event.count({ where: { deletedAt: null } }),
      prisma.event.count({ where: { active: true, deletedAt: null } }),
      prisma.spaceRequest.count({ where: { status: "REQUESTED" } }),
    ]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          totalBookings,
          confirmedBookings,
          pendingBookings,
          totalRevenue: revenueResult._sum.amountPaise || 0,
          totalClasses,
          activeClasses,
          totalEvents,
          activeEvents,
          pendingSpaceRequests,
        },
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Dashboard stats error:", errorMessage);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: "Failed to fetch dashboard stats" }),
    };
  }
};
