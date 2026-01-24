import { BookingType, BookingStatus, SpaceRequestStatus } from "@prisma/client";

export interface CreateBookingInput {
  type: BookingType;
  name: string;
  phone: string;
  email: string;
  classSessionId?: string;
  eventId?: string;
  preferredSlots?: string[];
  notes?: string;
  purpose?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RazorpayOrderResponse {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
        method: string;
      };
    };
    order?: {
      entity: {
        id: string;
        receipt: string;
      };
    };
  };
}
