// ============================================
// OSS BOOKING SYSTEM - CONSTANTS
// ============================================

// === API Endpoints ===

export const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "";

export const API_ENDPOINTS = {
  // Public
  CREATE_BOOKING: "/.netlify/functions/createBooking",
  CREATE_RAZORPAY_ORDER: "/.netlify/functions/createRazorpayOrder",
  GET_BOOKING: "/.netlify/functions/getBooking",
  GET_CLASSES: "/.netlify/functions/getClasses",
  GET_EVENTS: "/.netlify/functions/getEvents",
  VERIFY_PASS: "/.netlify/functions/verifyPass",
  
  // Dev Only
  DEV_CONFIRM_PAYMENT: "/.netlify/functions/devConfirmPayment",
  
  // Admin
  ADMIN_LOGIN: "/.netlify/functions/adminAuth",
  ADMIN_LOGOUT: "/.netlify/functions/adminAuth", // DELETE method
  ADMIN_LIST_BOOKINGS: "/.netlify/functions/adminListBookings",
  ADMIN_LIST_CLASSES: "/.netlify/functions/adminListClasses",
  ADMIN_CREATE_CLASS: "/.netlify/functions/adminCreateClass",
  ADMIN_UPDATE_CLASS: "/.netlify/functions/adminUpdateClass",
  ADMIN_LIST_EVENTS: "/.netlify/functions/adminListEvents",
  ADMIN_CREATE_EVENT: "/.netlify/functions/adminCreateEvent",
  ADMIN_UPDATE_EVENT: "/.netlify/functions/adminUpdateEvent",
  ADMIN_LIST_PASSES: "/.netlify/functions/adminListPasses",
  ADMIN_CHECKIN_PASS: "/.netlify/functions/adminCheckinPass",
  ADMIN_LIST_SPACE_REQUESTS: "/.netlify/functions/adminListSpaceRequests",
  ADMIN_UPDATE_SPACE_REQUEST: "/.netlify/functions/adminUpdateSpaceRequest",
  ADMIN_UPLOAD_IMAGE: "/.netlify/functions/adminUploadImage",
} as const;

// === Razorpay ===

export const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";

export const RAZORPAY_CONFIG = {
  name: "OSS Space",
  description: "Booking Payment",
  currency: "INR",
  theme: {
    color: "#ee751c", // OSS brand color
  },
} as const;

// === Booking Status Labels ===

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Pending Payment",
  CONFIRMED: "Confirmed",
  PAYMENT_FAILED: "Payment Failed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: "warning",
  CONFIRMED: "success",
  PAYMENT_FAILED: "destructive",
  CANCELLED: "secondary",
  EXPIRED: "secondary",
};

// === Space Request Status Labels ===

export const SPACE_STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  APPROVED_CALL_SCHEDULED: "Call Scheduled",
  RESCHEDULE_REQUESTED: "Reschedule Requested",
  DECLINED: "Declined",
  CONFIRMED: "Confirmed",
  NOT_PROCEEDING: "Not Proceeding",
  FOLLOW_UP_REQUIRED: "Follow-up Required",
};

export const SPACE_STATUS_COLORS: Record<string, string> = {
  REQUESTED: "info",
  APPROVED_CALL_SCHEDULED: "warning",
  RESCHEDULE_REQUESTED: "warning",
  DECLINED: "destructive",
  CONFIRMED: "success",
  NOT_PROCEEDING: "secondary",
  FOLLOW_UP_REQUIRED: "warning",
};

// === Check-in Status Labels ===

export const CHECKIN_STATUS_LABELS: Record<string, string> = {
  NOT_CHECKED_IN: "Not Checked In",
  CHECKED_IN: "Checked In",
};

// === Booking Type Labels ===

export const BOOKING_TYPE_LABELS: Record<string, string> = {
  CLASS: "Class",
  EVENT: "Event",
  SPACE: "Space",
};

// === Navigation ===

export const PUBLIC_NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/events" },
  { label: "Classes", href: "/classes" },
  { label: "Workshops", href: "/workshops" },
  { label: "Spaces", href: "/book-space" },
  { label: "Co-Working", href: "/co-working-space" },
  { label: "Community", href: "/community" },
  { label: "Initiatives", href: "/initiatives" },
  { label: "Visit", href: "/visit" },
  { label: "Contact", href: "/contact" },
] as const;

export const ADMIN_NAV_ITEMS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Bookings", href: "/admin/bookings" },
  { label: "Classes", href: "/admin/classes" },
  { label: "Events", href: "/admin/events" },
  { label: "Space Requests", href: "/admin/space" },
] as const;

// === Polling Config ===

export const POLLING_INTERVAL = 2000; // 2 seconds
export const POLLING_MAX_ATTEMPTS = 15; // 30 seconds total
export const POLLING_TIMEOUT = 30000; // 30 seconds

// === WhatsApp Templates (for reference) ===

export const WHATSAPP_TEMPLATES = {
  EVENT_CONFIRMED: "booking_event_confirmed",
  CLASS_CONFIRMED: "booking_class_confirmed",
  SPACE_CALL_SCHEDULED: "space_call_confirmed",
} as const;
