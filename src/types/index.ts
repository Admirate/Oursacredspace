// ============================================
// OSS BOOKING SYSTEM — TYPE DEFINITIONS
// ============================================

// === Enums ===

export type BookingType = "CLASS" | "EVENT" | "SPACE";

export type BookingStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "PAYMENT_FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "REQUESTED"
  | "APPROVED";

export type PaymentStatus = "CREATED" | "PAID" | "FAILED" | "REFUNDED";

export type SpaceRequestStatus =
  | "REQUESTED"
  | "APPROVED"
  | "DECLINED"
  | "CONFIRMED"
  | "CANCELLED";


// === Core Types ===

export interface Booking {
  id: string;
  type: BookingType;
  status: BookingStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  amountPaise?: number | null;
  currency?: string;
  quantity?: number;

  /** When an unpaid booking stops holding its seats. Null for SPACE bookings. */
  holdExpiresAt?: string | null;

  cancelledAt?: string | null;
  cancelReason?: string | null;
  version?: number;
  metadata?: Record<string, unknown> | null;

  classSessionId?: string | null;
  classSession?: ClassSession | null;
  eventId?: string | null;
  event?: Event | null;
  spaceRequest?: SpaceRequest | null;
  payments?: Payment[];

  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Payment {
  id: string;
  bookingId: string;
  provider: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
  status: PaymentStatus;
  amountPaise: number;
  currency: string;
  webhookEventId?: string | null;
  rawPayload?: unknown;
  refundedAt?: string | null;
  refundAmountPaise?: number | null;
  paymentExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
}

export type PricingType = "PER_SESSION" | "PER_MONTH";

export interface ClassSession {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  instructor?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt?: string | null;
  duration: number;
  capacity?: number | null;
  spotsBooked: number;
  bookedCount?: number;
  availableSpots?: number | null;
  pricePaise: number;
  active: boolean;
  isRecurring?: boolean;
  recurrenceDays?: number[];
  timeSlots?: TimeSlot[] | null;
  pricingType?: PricingType;
  isExpired?: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Event {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  startsAt: string;
  endsAt?: string | null;
  venue: string;
  pricePaise: number;
  capacity?: number | null;
  passesIssued?: number;
  bookedCount?: number;
  availableSpots?: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}


export interface SpaceRequest {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  preferredSlots?: string[];
  scheduledSlot?: string | null;
  notes?: string | null;
  purpose?: string | null;
  status: SpaceRequestStatus;
  adminNotes?: string | null;
  booking?: Booking;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface NotificationLog {
  id: string;
  bookingId?: string | null;
  channel: "WHATSAPP" | "EMAIL";
  templateName: string;
  to: string;
  status: "SENT" | "FAILED" | "PENDING";
  providerMessageId?: string | null;
  error?: string | null;
  retryCount: number;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistory {
  id: string;
  bookingId: string;
  fromStatus: string;
  toStatus: string;
  changedBy: string;
  reason?: string | null;
  createdAt: string;
}

// === API Request/Response Types ===

export interface CreateBookingRequest {
  type: BookingType;
  name: string;
  phone: string;
  email: string;
  /** Number of seats/passes (CLASS/EVENT). Defaults to 1 server-side. */
  quantity?: number;
  classSessionId?: string;
  eventId?: string;
  preferredSlots?: string[];
  purpose?: string;
  notes?: string;
}

export interface CreateBookingResponse {
  success: boolean;
  data: {
    /**
     * SECURITY (SEC-005, SEC-006): Present ONLY for a freshly created booking,
     * where the caller supplied their own details. Absent when the response is
     * a resume-email acknowledgement (`resumeEmailSent`), because the token for
     * an existing booking is delivered by email, never in this body.
     */
    bookingId?: string;
    accessToken?: string;
    type?: BookingType;
    amount?: number;
    requiresPayment: boolean;
    /**
     * SECURITY (SEC-004): True when the request collided with an existing
     * unpaid booking. The resume link has been emailed to the booking's own
     * address; no bookingId or token is returned. The client should tell the
     * user to check their email rather than opening payment directly.
     */
    resumeEmailSent?: boolean;
  };
  error?: string;
}

export interface CreateRazorpayOrderRequest {
  bookingId: string;
  /** SECURITY (SEC-006): Per-booking access token returned by createBooking. */
  accessToken: string;
}

export interface CreateRazorpayOrderResponse {
  success: boolean;
  data?: {
    orderId: string;
    keyId: string;
    amount: number;
    currency: string;
    bookingId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  };
  error?: string;
}

export interface VerifyPaymentRequest {
  bookingId: string;
  /** SECURITY (SEC-006): Per-booking access token from createBooking. */
  accessToken: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  data?: {
    bookingId: string;
    status: "CONFIRMED";
    alreadyProcessed: boolean;
  };
  error?: string;
}

export interface GetBookingResponse {
  success: boolean;
  data?: Booking;
  error?: string;
}

// === Admin Types ===

export interface AdminListBookingsRequest {
  type?: BookingType;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface AdminListBookingsResponse {
  success: boolean;
  data: Booking[];
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
  };
  error?: string;
}

export interface AdminUpdateSpaceRequestRequest {
  requestId: string;
  status: SpaceRequestStatus;
  adminNotes?: string;
}


// === Razorpay Types ===

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  theme: {
    color: string;
  };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: {
    ondismiss?: () => void;
    confirm_close?: boolean;
    escape?: boolean;
  };
  /** Razorpay checkout auto-close timeout (seconds). */
  timeout?: number;
  notes?: Record<string, string>;
  retry?: {
    enabled: boolean;
    max_count?: number;
  };
}

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open: () => void;
      close: () => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      on: (event: string, handler: (response: any) => void) => void;
    };
  }
}
