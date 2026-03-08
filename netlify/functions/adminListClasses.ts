import { Handler } from "@netlify/functions";
import { prisma } from "./helpers/prisma";
import { verifyAdminSession, unauthorizedResponse, getAdminHeaders } from "./helpers/verifyAdmin";

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
    const now = new Date();

    // Auto-deactivate classes whose time has passed
    await prisma.classSession.updateMany({
      where: {
        active: true,
        startsAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
      data: { active: false },
    });

    const classes = await prisma.classSession.findMany({
      orderBy: { startsAt: "desc" },
      include: {
        _count: {
          select: { bookings: true },
        },
      },
    });

    const classesWithExpiry = classes.map((c) => {
      const endTime = new Date(c.startsAt.getTime() + c.duration * 60 * 1000);
      return { ...c, isExpired: endTime < now };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: classesWithExpiry,
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
