import { Handler } from "@netlify/functions";
import { prisma } from "./helpers/prisma";
import { verifyAdminSession, unauthorizedResponse, getAdminHeaders } from "./helpers/verifyAdmin";
import { BookingType, BookingStatus } from "@prisma/client";
import { getClientIP, isRateLimited, rateLimitResponse, RATE_LIMITS } from "./helpers/security";

// SECURITY: Date format validation (ISO 8601)
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
// SECURITY: Search string max length and sanitization
const MAX_SEARCH_LENGTH = 100;
const SEARCH_SANITIZE_REGEX = /[<>'"%;()&\\]/g;

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

  // SECURITY: Rate limit admin endpoints
  const clientIP = getClientIP(event);
  if (isRateLimited(`admin:listBookings:${clientIP}`, RATE_LIMITS.ADMIN_READ.maxRequests, RATE_LIMITS.ADMIN_READ.windowMs)) {
    return rateLimitResponse();
  }

  // Verify admin session
  const authResult = await verifyAdminSession(event);
  if (!authResult.isValid) {
    return unauthorizedResponse(event, authResult.error);
  }

  try {
    const params = event.queryStringParameters || {};
    
    // SECURITY: Validate and sanitize pagination params
    const rawPage = parseInt(params.page || "1", 10);
    const rawLimit = parseInt(params.limit || "20", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 100);
    const skip = (page - 1) * limit;

    // Build filter
    const where: any = {};

    if (params.type && Object.values(BookingType).includes(params.type as BookingType)) {
      where.type = params.type;
    }

    if (params.status && Object.values(BookingStatus).includes(params.status as BookingStatus)) {
      where.status = params.status;
    }

    // SECURITY: Validate date format before parsing
    if (params.startDate) {
      if (!ISO_DATE_REGEX.test(params.startDate)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: "Invalid startDate format" }),
        };
      }
      const startDate = new Date(params.startDate);
      if (isNaN(startDate.getTime())) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: "Invalid startDate" }),
        };
      }
      where.createdAt = { ...where.createdAt, gte: startDate };
    }

    if (params.endDate) {
      if (!ISO_DATE_REGEX.test(params.endDate)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: "Invalid endDate format" }),
        };
      }
      const endDate = new Date(params.endDate);
      if (isNaN(endDate.getTime())) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: "Invalid endDate" }),
        };
      }
      where.createdAt = { ...where.createdAt, lte: endDate };
    }

    // SECURITY: Sanitize search input
    if (params.search) {
      const sanitizedSearch = params.search
        .slice(0, MAX_SEARCH_LENGTH)
        .replace(SEARCH_SANITIZE_REGEX, "")
        .trim();
      
      if (sanitizedSearch.length > 0) {
        where.OR = [
          { name: { contains: sanitizedSearch, mode: "insensitive" } },
          { email: { contains: sanitizedSearch, mode: "insensitive" } },
          { id: { contains: sanitizedSearch } },
        ];
      }
    }

    // Get bookings with count
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          classSession: { select: { title: true } },
          event: { select: { title: true } },
          spaceRequest: { select: { status: true } },
          payments: {
            select: { status: true, razorpayPaymentId: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          eventPass: { select: { passId: true, checkInStatus: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          bookings,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("List bookings error:", errorMessage);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch bookings",
      }),
    };
  }
};
