// ============================================
// OSS BOOKING SYSTEM - TYPE DEFINITIONS
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
  classSessionId?: string | null;
  classSession?: ClassSession | null;
  eventId?: string | null;
  event?: Event | null;
  spaceRequest?: SpaceRequest | null;
  payments?: Payment[];
  eventPass?: EventPass | null;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface ClassSession {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  startsAt: string;
  duration: number;
  capacity: number;
  spotsBooked: number;
  pricePaise: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  startsAt: string;
  venue: string;
  pricePaise: number;
  capacity?: number | null;
  passesIssued?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
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
  bookingId: string;
  booking?: Booking;
  preferredDate: string;
  duration: number;
  purpose: string;
  attendees?: number | null;
  specialRequirements?: string | null;
  status: SpaceRequestStatus;
  adminNotes?: string | null;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
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
  // For SPACE bookings
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
