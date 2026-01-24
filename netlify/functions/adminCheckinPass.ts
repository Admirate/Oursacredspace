import { Handler } from "@netlify/functions";
import { z } from "zod";
import { prisma } from "./helpers/prisma";
import { verifyAdminSession, unauthorizedResponse, getAdminHeaders } from "./helpers/verifyAdmin";
import { CheckInStatus } from "@prisma/client";

const checkinSchema = z.object({
  passId: z.string().regex(/^OSS-EV-[A-Z0-9]{8}$/, "Invalid pass ID format"),
});

export const handler: Handler = async (event) => {
  const headers = getAdminHeaders(event);
  
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
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
    const body = JSON.parse(event.body || "{}");
    const { passId } = checkinSchema.parse(body);

    // Find pass
    const eventPass = await prisma.eventPass.findUnique({
      where: { passId },
      include: {
        event: { select: { title: true } },
        booking: { select: { name: true, status: true } },
      },
    });

    if (!eventPass) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Pass not found",
        }),
      };
    }

    // Check if booking is confirmed
    if (eventPass.booking.status !== "CONFIRMED") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Cannot check in - booking status is ${eventPass.booking.status}`,
        }),
      };
    }

    // Check if already checked in
    if (eventPass.checkInStatus === CheckInStatus.CHECKED_IN) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            passId: eventPass.passId,
            attendeeName: eventPass.booking.name,
            eventTitle: eventPass.event.title,
            checkInTime: eventPass.checkInTime,
            alreadyCheckedIn: true,
          },
        }),
      };
    }

    // Update check-in status
    const checkInTime = new Date();
    await prisma.eventPass.update({
      where: { passId },
      data: {
        checkInStatus: CheckInStatus.CHECKED_IN,
        checkInTime,
        checkedInBy: authResult.email,
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          passId: eventPass.passId,
          attendeeName: eventPass.booking.name,
          eventTitle: eventPass.event.title,
          checkInTime,
          alreadyCheckedIn: false,
        },
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Check-in error:", errorMessage);

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: error.errors[0]?.message || "Invalid pass ID",
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage || "Check-in failed",
      }),
    };
  }
};
