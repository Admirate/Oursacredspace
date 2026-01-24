import { Handler } from "@netlify/functions";
import { z } from "zod";
import { prisma } from "./helpers/prisma";
import { verifyAdminSession, unauthorizedResponse, getAdminHeaders } from "./helpers/verifyAdmin";

const createEventSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().max(1000).optional().nullable(),
  startsAt: z.string(),
  venue: z.string().min(2).max(200),
  pricePaise: z.number().min(0),
  capacity: z.number().min(1).max(10000).optional().nullable(),
  active: z.boolean().default(true),
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
    const data = createEventSchema.parse(body);

    const newEvent = await prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        startsAt: new Date(data.startsAt),
        venue: data.venue,
        pricePaise: data.pricePaise,
        capacity: data.capacity,
        active: data.active,
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: newEvent,
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Create event error:", errorMessage);

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: error.errors[0]?.message || "Validation error",
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage || "Failed to create event",
      }),
    };
  }
};
