import { Handler } from "@netlify/functions";
import { z } from "zod";
import { prisma } from "./helpers/prisma";
import { verifyAdminSession, unauthorizedResponse, getAdminHeaders } from "./helpers/verifyAdmin";
import { isRateLimited, getClientIP, RATE_LIMITS, rateLimitResponse } from "./helpers/security";

const createEventSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().max(1000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  startsAt: z.string(),
  endsAt: z.string().optional().nullable(),
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

  // SECURITY (SEC-019): Rate limit admin write operations
  const clientIP = getClientIP(event);
  if (isRateLimited(`admin-write:${clientIP}`, RATE_LIMITS.ADMIN_WRITE.maxRequests, RATE_LIMITS.ADMIN_WRITE.windowMs)) {
    return rateLimitResponse();
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const data = createEventSchema.parse(body);

    const newEvent = await prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
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
        error: "Failed to create event",
      }),
    };
  }
};
