import { Handler } from "@netlify/functions";
import { z } from "zod";
import { prisma } from "./helpers/prisma";
import { verifyAdminSession, unauthorizedResponse, getAdminHeaders } from "./helpers/verifyAdmin";

const updateClassSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  startsAt: z.string().datetime().optional(),
  duration: z.number().min(15).max(480).optional(),
  capacity: z.number().min(1).max(100).optional(),
  pricePaise: z.number().min(0).optional(),
  active: z.boolean().optional(),
});

export const handler: Handler = async (event) => {
  const headers = getAdminHeaders(event);
  
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "PUT") {
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
    const { id, ...data } = updateClassSchema.parse(body);

    // Check if class exists
    const existing = await prisma.classSession.findUnique({
      where: { id },
    });

    if (!existing) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Class not found",
        }),
      };
    }

    const classSession = await prisma.classSession.update({
      where: { id },
      data: {
        ...data,
        startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
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
    console.error("Update class error:", errorMessage);

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
        error: errorMessage || "Failed to update class",
      }),
    };
  }
};
