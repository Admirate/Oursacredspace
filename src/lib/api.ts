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
    apiFetch<{ success: boolean }>(API_ENDPOINTS.ADMIN_LOGOUT, {
      method: "POST",
      credentials: "include",
    }),

  // Bookings
  listBookings: (params?: AdminListBookingsRequest) =>
    apiFetch<AdminListBookingsResponse>(API_ENDPOINTS.ADMIN_LIST_BOOKINGS, {
      params: params as Record<string, string | number | undefined>,
      credentials: "include",
    }),

  // Classes
  listClasses: () =>
    apiFetch<{ success: boolean; data: ClassSession[] }>(
      API_ENDPOINTS.ADMIN_LIST_CLASSES,
      { credentials: "include" }
    ),

  createClass: (data: Omit<ClassSession, "id" | "createdAt" | "updatedAt" | "spotsBooked">) =>
    apiFetch<{ success: boolean; data: ClassSession }>(
      API_ENDPOINTS.ADMIN_CREATE_CLASS,
      {
        method: "POST",
        body: JSON.stringify(data),
        credentials: "include",
      }
    ),

  updateClass: (id: string, data: Partial<ClassSession>) =>
    apiFetch<{ success: boolean; data: ClassSession }>(
      API_ENDPOINTS.ADMIN_UPDATE_CLASS,
      {
        method: "PUT",
        body: JSON.stringify({ id, ...data }),
        credentials: "include",
      }
    ),

  // Events
  listEvents: () =>
    apiFetch<{ success: boolean; data: Event[] }>(
      API_ENDPOINTS.ADMIN_LIST_EVENTS,
      { credentials: "include" }
    ),

  createEvent: (data: Omit<Event, "id" | "createdAt" | "updatedAt">) =>
    apiFetch<{ success: boolean; data: Event }>(
      API_ENDPOINTS.ADMIN_CREATE_EVENT,
      {
        method: "POST",
        body: JSON.stringify(data),
        credentials: "include",
      }
    ),

  updateEvent: (id: string, data: Partial<Event>) =>
    apiFetch<{ success: boolean; data: Event }>(
      API_ENDPOINTS.ADMIN_UPDATE_EVENT,
      {
        method: "PUT",
        body: JSON.stringify({ id, ...data }),
        credentials: "include",
      }
    ),

  // Passes
  listPasses: (eventId?: string) =>
    apiFetch<{ success: boolean; data: EventPass[] }>(
      API_ENDPOINTS.ADMIN_LIST_PASSES,
      {
        params: { eventId },
        credentials: "include",
      }
    ),

  checkinPass: (data: AdminCheckinPassRequest) =>
    apiFetch<AdminCheckinPassResponse>(API_ENDPOINTS.ADMIN_CHECKIN_PASS, {
      method: "POST",
      body: JSON.stringify(data),
      credentials: "include",
    }),

  // Space Requests
  listSpaceRequests: (status?: string) =>
    apiFetch<{ success: boolean; data: SpaceRequest[] }>(
      API_ENDPOINTS.ADMIN_LIST_SPACE_REQUESTS,
      {
        params: { status },
        credentials: "include",
      }
    ),

  updateSpaceRequest: (data: AdminUpdateSpaceRequestRequest) =>
    apiFetch<{ success: boolean; data: SpaceRequest }>(
      API_ENDPOINTS.ADMIN_UPDATE_SPACE_REQUEST,
      {
        method: "POST",
        body: JSON.stringify(data),
        credentials: "include",
      }
    ),
};
