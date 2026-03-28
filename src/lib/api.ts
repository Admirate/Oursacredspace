import { API_ENDPOINTS } from "./constants";
import type {
  CreateBookingRequest,
  CreateBookingResponse,
  CreateRazorpayOrderRequest,
  CreateRazorpayOrderResponse,
  GetBookingResponse,
  AdminListBookingsRequest,
  AdminListBookingsResponse,
  AdminUpdateSpaceRequestRequest,
  AdminCheckinPassRequest,
  AdminCheckinPassResponse,
  ClassSession,
  Event,
  SpaceRequest,
  EventPass,
} from "@/types";

// === Base Fetch Helper ===

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

const apiFetch = async <T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> => {
  const { params, ...fetchOptions } = options;

  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...fetchOptions.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "An error occurred");
  }

  return data;
};

// === Public API ===

export const api = {
  // Booking
  createBooking: (data: CreateBookingRequest) =>
    apiFetch<CreateBookingResponse>(API_ENDPOINTS.CREATE_BOOKING, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createRazorpayOrder: (data: CreateRazorpayOrderRequest) =>
    apiFetch<CreateRazorpayOrderResponse>(API_ENDPOINTS.CREATE_RAZORPAY_ORDER, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getBooking: (bookingId: string) =>
    apiFetch<GetBookingResponse>(API_ENDPOINTS.GET_BOOKING, {
      params: { bookingId },
    }),

  // Classes
  getClasses: () =>
    apiFetch<{ success: boolean; data: ClassSession[] }>(
      API_ENDPOINTS.GET_CLASSES
    ),

  // Events
  getEvents: () =>
    apiFetch<{ success: boolean; data: Event[] }>(API_ENDPOINTS.GET_EVENTS),

  // Pass Verification
  verifyPass: (passId: string) =>
    apiFetch<{
      success: boolean;
      data: {
        valid: boolean;
        pass?: EventPass;
        event?: Event;
        attendeeName?: string;
      };
    }>(API_ENDPOINTS.VERIFY_PASS, {
      params: { passId },
    }),
};

// === Admin API fetch wrapper (auto-injects CSRF token for mutations) ===

const getCsrfToken = (): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

const adminApiFetch = async <T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> => {
  const method = (options.method || "GET").toUpperCase();
  const csrfHeaders: Record<string, string> = {};
  if (method !== "GET" && method !== "OPTIONS") {
    const csrf = getCsrfToken();
    if (csrf) csrfHeaders["X-CSRF-Token"] = csrf;
  }
  return apiFetch<T>(endpoint, {
    ...options,
    credentials: "include",
    headers: { ...csrfHeaders, ...(options.headers as Record<string, string> || {}) },
  });
};

// === Admin API ===

export const adminApi = {
  // Auth
  login: (email: string, password: string) =>
    apiFetch<{ success: boolean; data?: { email: string }; error?: string }>(
      API_ENDPOINTS.ADMIN_LOGIN,
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
        credentials: "include",
      }
    ),

  logout: () =>
    adminApiFetch<{ success: boolean }>(API_ENDPOINTS.ADMIN_LOGOUT, {
      method: "DELETE",
    }),

  // Bookings
  listBookings: (params?: AdminListBookingsRequest) =>
    adminApiFetch<AdminListBookingsResponse>(API_ENDPOINTS.ADMIN_LIST_BOOKINGS, {
      params: params as Record<string, string | number | undefined>,
    }),

  // Classes
  listClasses: () =>
    adminApiFetch<{ success: boolean; data: ClassSession[] }>(
      API_ENDPOINTS.ADMIN_LIST_CLASSES
    ),

  createClass: (data: Omit<ClassSession, "id" | "createdAt" | "updatedAt" | "spotsBooked">) =>
    adminApiFetch<{ success: boolean; data: ClassSession }>(
      API_ENDPOINTS.ADMIN_CREATE_CLASS,
      { method: "POST", body: JSON.stringify(data) }
    ),

  updateClass: (id: string, data: Partial<ClassSession>) =>
    adminApiFetch<{ success: boolean; data: ClassSession }>(
      API_ENDPOINTS.ADMIN_UPDATE_CLASS,
      { method: "PUT", body: JSON.stringify({ id, ...data }) }
    ),

  deleteClass: (id: string) =>
    adminApiFetch<{ success: boolean }>(
      API_ENDPOINTS.ADMIN_DELETE_CLASS,
      { method: "DELETE", body: JSON.stringify({ id }) }
    ),

  // Events
  listEvents: () =>
    adminApiFetch<{ success: boolean; data: Event[] }>(
      API_ENDPOINTS.ADMIN_LIST_EVENTS
    ),

  createEvent: (data: Omit<Event, "id" | "createdAt" | "updatedAt">) =>
    adminApiFetch<{ success: boolean; data: Event }>(
      API_ENDPOINTS.ADMIN_CREATE_EVENT,
      { method: "POST", body: JSON.stringify(data) }
    ),

  updateEvent: (id: string, data: Partial<Event>) =>
    adminApiFetch<{ success: boolean; data: Event }>(
      API_ENDPOINTS.ADMIN_UPDATE_EVENT,
      { method: "PUT", body: JSON.stringify({ id, ...data }) }
    ),

  deleteEvent: (id: string) =>
    adminApiFetch<{ success: boolean }>(
      API_ENDPOINTS.ADMIN_DELETE_EVENT,
      { method: "DELETE", body: JSON.stringify({ id }) }
    ),

  // Passes
  listPasses: (eventId?: string) =>
    adminApiFetch<{ success: boolean; data: EventPass[] }>(
      API_ENDPOINTS.ADMIN_LIST_PASSES,
      { params: { eventId } }
    ),

  checkinPass: (data: AdminCheckinPassRequest) =>
    adminApiFetch<AdminCheckinPassResponse>(API_ENDPOINTS.ADMIN_CHECKIN_PASS, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Space Requests
  listSpaceRequests: (status?: string) =>
    adminApiFetch<{ success: boolean; data: SpaceRequest[] }>(
      API_ENDPOINTS.ADMIN_LIST_SPACE_REQUESTS,
      { params: { status } }
    ),

  updateSpaceRequest: (data: AdminUpdateSpaceRequestRequest) =>
    adminApiFetch<{ success: boolean; data: SpaceRequest }>(
      API_ENDPOINTS.ADMIN_UPDATE_SPACE_REQUEST,
      { method: "POST", body: JSON.stringify(data) }
    ),

  // Image Upload
  uploadImage: (image: string, fileName: string, folder: string = "classes") =>
    adminApiFetch<{ success: boolean; data: { url: string; path: string } }>(
      API_ENDPOINTS.ADMIN_UPLOAD_IMAGE,
      { method: "POST", body: JSON.stringify({ image, fileName, folder }) }
    ),
};
