import { Handler } from "@netlify/functions";
import { z } from "zod";
import { prisma } from "./helpers/prisma";
import { getClientIP, isRateLimited, rateLimitResponse, getPublicHeaders } from "./helpers/security";

const enquirySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).trim(),
  email: z.string().email("Please enter a valid email").max(254).toLowerCase(),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number")
    .optional()
    .or(z.literal("")),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000).trim(),
});

export const handler: Handler = async (event) => {
  const headers = getPublicHeaders(event, "POST, OPTIONS");

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

  // Rate limit: 5 enquiries per minute per IP
  const clientIP = getClientIP(event);
  if (isRateLimited(`enquiry:${clientIP}`, 5, 60000)) {
    return rateLimitResponse();
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const data = enquirySchema.parse(body);

    // Store in database
    const enquiry = await prisma.contactEnquiry.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        message: data.message,
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: { id: enquiry.id },
      }),
    };
  } catch (error) {
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

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Create enquiry error:", errorMessage);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to submit enquiry. Please try again.",
      }),
    };
  }
};
