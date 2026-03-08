import { Handler } from "@netlify/functions";
import { z } from "zod";
import { prisma } from "./helpers/prisma";
import { verifyAdminSession, unauthorizedResponse, getAdminHeaders } from "./helpers/verifyAdmin";

const timeSlotSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const createClassSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  instructor: z.string().max(100).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  startsAt: z.string(),
  endsAt: z.string().optional().nullable(),
  duration: z.number().min(15).max(480).default(60),
  capacity: z.number().min(0).max(1000).optional().nullable(),
  pricePaise: z.number().min(0),
  active: z.boolean().default(true),
  isRecurring: z.boolean().default(false),
  recurrenceDays: z.array(z.number().min(0).max(6)).default([]),
  timeSlots: z.array(timeSlotSchema).optional().nullable(),
  pricingType: z.enum(["PER_SESSION", "PER_MONTH"]).default("PER_SESSION"),
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
    const data = createClassSchema.parse(body);

    const classSession = await prisma.classSession.create({
      data: {
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        instructor: data.instructor,
        location: data.location,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        duration: data.duration,
        capacity: data.capacity ?? null,
        pricePaise: data.pricePaise,
        active: data.active,
        isRecurring: data.isRecurring,
        recurrenceDays: data.recurrenceDays,
        timeSlots: data.timeSlots ?? undefined,
        pricingType: data.pricingType,
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: classSession,
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Create class error:", errorMessage);

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
        error: errorMessage || "Failed to create class",
      }),
    };
  }
};
