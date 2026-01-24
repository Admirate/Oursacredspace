import { Handler } from "@netlify/functions";
import { prisma } from "./helpers/prisma";
import { verifyAdminSession, unauthorizedResponse, getAdminHeaders } from "./helpers/verifyAdmin";
import { BookingType, BookingStatus } from "@prisma/client";

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

  // Verify admin session
  const authResult = await verifyAdminSession(event);
  if (!authResult.isValid) {
    return unauthorizedResponse(event, authResult.error);
  }

  try {
    const params = event.queryStringParameters || {};
    const page = parseInt(params.page || "1", 10);
    const limit = Math.min(parseInt(params.limit || "20", 10), 100);
    const skip = (page - 1) * limit;

    // Build filter
    const where: any = {};

    if (params.type && Object.values(BookingType).includes(params.type as BookingType)) {
      where.type = params.type;
    }

    if (params.status && Object.values(BookingStatus).includes(params.status as BookingStatus)) {
      where.status = params.status;
    }

    if (params.startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(params.startDate) };
    }

    if (params.endDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(params.endDate) };
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
        { id: { contains: params.search } },
      ];
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
