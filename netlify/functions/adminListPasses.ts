import { Handler } from "@netlify/functions";
import { prisma } from "./helpers/prisma";
import { verifyAdminSession, unauthorizedResponse, getAdminHeaders } from "./helpers/verifyAdmin";

// SECURITY: UUID v4 format validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    // SECURITY: Validate eventId format if provided
    if (eventId && !UUID_REGEX.test(eventId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: "Invalid eventId format" }),
      };
    }

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
