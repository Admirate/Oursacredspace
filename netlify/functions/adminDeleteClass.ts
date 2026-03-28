import { Handler } from "@netlify/functions";
import { z } from "zod";
import { prisma } from "./helpers/prisma";
import { verifyAdminSession, unauthorizedResponse, getAdminHeaders } from "./helpers/verifyAdmin";

const deleteClassSchema = z.object({
  id: z.string().min(1).max(30),
});

export const handler: Handler = async (event) => {
  const headers = getAdminHeaders(event);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "DELETE") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: "Method not allowed" }),
    };
  }

  const authResult = await verifyAdminSession(event);
  if (!authResult.isValid) {
    return unauthorizedResponse(event, authResult.error);
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { id } = deleteClassSchema.parse(body);

    const existing = await prisma.classSession.findUnique({
      where: { id },
    });

    if (!existing) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: "Class not found" }),
      };
    }

    // Soft delete: set deletedAt and deactivate
    await prisma.classSession.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        active: false,
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Delete class error:", errorMessage);

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: error.errors[0]?.message || "Validation error" }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: "Failed to delete class" }),
    };
  }
};
