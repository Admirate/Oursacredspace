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
    const eventId = event.queryStringParameters?.eventId;

    const where = eventId ? { eventId } : {};

    const passes = await prisma.eventPass.findMany({
      where,
      include: {
        event: { select: { title: true, startsAt: true } },
        booking: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: passes.map((pass) => ({
          id: pass.id,
          passId: pass.passId,
          checkInStatus: pass.checkInStatus,
          checkInTime: pass.checkInTime,
          checkedInBy: pass.checkedInBy,
          eventTitle: pass.event.title,
          eventDate: pass.event.startsAt,
          attendeeName: pass.booking.name,
          attendeeEmail: pass.booking.email,
          attendeePhone: pass.booking.phone,
          createdAt: pass.createdAt,
        })),
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("List passes error:", errorMessage);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch passes",
      }),
    };
  }
};
