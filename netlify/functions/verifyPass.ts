import { Handler } from "@netlify/functions";
import { prisma } from "./helpers/prisma";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const handler: Handler = async (event) => {
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

  try {
    const passId = event.queryStringParameters?.passId;

    if (!passId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: "passId is required" }),
      };
    }

    const eventPass = await prisma.eventPass.findUnique({
      where: { passId },
      include: {
        event: true,
        booking: {
          select: {
            name: true,
            phone: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!eventPass) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: true,
          data: { valid: false },
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          valid: true,
          pass: {
            id: eventPass.id,
            passId: eventPass.passId,
            checkInStatus: eventPass.checkInStatus,
            checkInTime: eventPass.checkInTime,
          },
          event: eventPass.event,
          attendeeName: eventPass.booking.name,
          bookingStatus: eventPass.booking.status,
        },
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Verify pass error:", errorMessage);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to verify pass",
      }),
    };
  }
};
