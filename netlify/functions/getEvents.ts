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
    const includeInactive = event.queryStringParameters?.includeInactive === "true";

    const events = await prisma.event.findMany({
      where: includeInactive
        ? {}
        : {
            active: true,
            startsAt: { gte: new Date() }, // Only future events
          },
      orderBy: { startsAt: "asc" },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: events,
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Get events error:", errorMessage);
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
