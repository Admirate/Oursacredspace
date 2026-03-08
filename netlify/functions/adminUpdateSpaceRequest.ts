import { Handler } from "@netlify/functions";
import { z } from "zod";
import { prisma } from "./helpers/prisma";
import { verifyAdminSession, unauthorizedResponse, getAdminHeaders } from "./helpers/verifyAdmin";
import { SpaceRequestStatus, BookingStatus } from "@prisma/client";
// TODO: Uncomment when WhatsApp is configured
// import { sendSpaceCallConfirmation } from "./helpers/sendWhatsApp";

// Accept the status values that the frontend sends
const updateSchema = z.object({
  requestId: z.string().min(1).max(30),
  status: z.enum(["APPROVED", "DECLINED", "CONFIRMED", "CANCELLED", "REQUESTED"]),
  adminNotes: z.string().max(500).optional(),
});

// Map frontend status to Prisma enum values
const statusMap: Record<string, SpaceRequestStatus> = {
  APPROVED: SpaceRequestStatus.APPROVED_CALL_SCHEDULED,
  DECLINED: SpaceRequestStatus.DECLINED,
  CONFIRMED: SpaceRequestStatus.CONFIRMED,
  CANCELLED: SpaceRequestStatus.NOT_PROCEEDING,
  REQUESTED: SpaceRequestStatus.REQUESTED,
};

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
    const { requestId, status, adminNotes } = updateSchema.parse(body);

    const spaceRequest = await prisma.spaceRequest.findUnique({
      where: { id: requestId },
      include: { booking: { select: { id: true } } },
    });

    if (!spaceRequest) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Space request not found",
        }),
      };
    }

    // Map frontend status to Prisma enum
    const prismaStatus = statusMap[status];
    if (!prismaStatus) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Invalid status",
        }),
      };
    }

    const updatedRequest = await prisma.spaceRequest.update({
      where: { id: requestId },
      data: {
        status: prismaStatus,
        adminNotes: adminNotes || spaceRequest.adminNotes,
      },
    });

    // Sync the associated booking status
    const bookingStatusMap: Record<string, BookingStatus> = {
      APPROVED: BookingStatus.PENDING_PAYMENT,
      DECLINED: BookingStatus.DECLINED,
      CONFIRMED: BookingStatus.CONFIRMED,
      CANCELLED: BookingStatus.CANCELLED,
      REQUESTED: BookingStatus.REQUESTED,
    };

    const newBookingStatus = bookingStatusMap[status];
    if (newBookingStatus && spaceRequest.booking?.id) {
      await prisma.booking.update({
        where: { id: spaceRequest.booking.id },
        data: { status: newBookingStatus },
      });
    }

    if (status === "APPROVED") {
      await prisma.notificationLog.create({
        data: {
          channel: "WHATSAPP",
          templateName: "space_approved",
          to: spaceRequest.customerPhone,
          status: "PENDING",
        },
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: updatedRequest,
      }),
    };
  } catch (error) {
    // Log full error server-side only
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Update space request error:", errorMessage);

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

    // SECURITY: Never expose internal error details to client
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to update space request",
      }),
    };
  }
};
