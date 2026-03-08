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

export type CheckInStatus = "NOT_CHECKED_IN" | "CHECKED_IN";

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
  eventPass?: EventPass | null;

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
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface EventPass {
  id: string;
  bookingId: string;
  booking?: Booking;
  eventId: string;
  event?: Event;
  passId: string;
  qrImageUrl: string;
  checkInStatus: CheckInStatus;
  checkInTime?: string | null;
  checkedInBy?: string | null;
  createdAt: string;
  updatedAt?: string;
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
  classSessionId?: string;
  eventId?: string;
  preferredSlots?: string[];
  purpose?: string;
  notes?: string;
}

export interface CreateBookingResponse {
  success: boolean;
  data: {
    bookingId: string;
    type: BookingType;
    amount: number;
    requiresPayment: boolean;
  };
  error?: string;
}

export interface CreateRazorpayOrderRequest {
  bookingId: string;
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

export interface GetBookingResponse {
  success: boolean;
  data?: Booking;
  error?: string;
}

// === Admin Types ===

export interface AdminListBookingsRequest {
  type?: BookingType;
  status?: string;
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

export interface AdminCheckinPassRequest {
  passId: string;
  adminEmail: string;
}

export interface AdminCheckinPassResponse {
  success: boolean;
  data?: {
    passId: string;
    attendeeName: string;
    eventTitle: string;
    checkInTime: string;
    alreadyCheckedIn: boolean;
  };
  error?: string;
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
    };
  }
}
