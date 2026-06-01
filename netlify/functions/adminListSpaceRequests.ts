import { Handler } from "@netlify/functions";
import { prisma } from "./helpers/prisma";
import { verifyAdminSession, unauthorizedResponse, getAdminHeaders } from "./helpers/verifyAdmin";
import { SpaceRequestStatus } from "@prisma/client";

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
    const status = event.queryStringParameters?.status;

    const where = status && Object.values(SpaceRequestStatus).includes(status as SpaceRequestStatus)
      ? { status: status as SpaceRequestStatus }
      : {};

    const page = Math.max(1, parseInt(event.queryStringParameters?.page || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(event.queryStringParameters?.limit || "20", 10) || 20));

    const [spaceRequests, total] = await Promise.all([
      prisma.spaceRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        preferredSlots: true,
        scheduledSlot: true,
        notes: true,
        purpose: true,
        status: true,
        adminNotes: true,
        createdAt: true,
        booking: {
          select: { id: true, status: true },
        },
      },
    }),
      prisma.spaceRequest.count({ where }),
    ]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: spaceRequests,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("List space requests error:", errorMessage);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch space requests",
      }),
    };
  }
};
