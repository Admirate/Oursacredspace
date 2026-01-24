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
    const events = await prisma.event.findMany({
      orderBy: { startsAt: "desc" },
      include: {
        _count: {
          select: { 
            bookings: true,
            eventPasses: true,
          },
        },
        eventPasses: {
          select: {
            checkInStatus: true,
          },
        },
      },
    });

    // Calculate check-in counts
    const eventsWithStats = events.map((event) => {
      const checkedInCount = event.eventPasses.filter(
        (p) => p.checkInStatus === "CHECKED_IN"
      ).length;
      
      return {
        ...event,
        passesIssued: event._count.eventPasses,
        checkIns: checkedInCount,
        eventPasses: undefined, // Remove raw passes
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: eventsWithStats,
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
