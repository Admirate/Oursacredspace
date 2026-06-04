import * as Sentry from "@sentry/nextjs";
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
  ClassSession,
  Event,
  SpaceRequest,
} from "@/types";

// === Base Fetch Helper ===

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

const API_TIMEOUT_MS = 30_000;

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

  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out. Please check your connection and try again.");
    }
    Sentry.captureException(err, { tags: { api_endpoint: endpoint } });
    throw new Error("Unable to connect. Please check your internet connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  let data: T & { error?: string; success?: boolean };
  try {
    data = await response.json();
  } catch {
    Sentry.captureMessage(`Non-JSON response from ${endpoint}`, {
      level: "error",
      extra: { status: response.status, statusText: response.statusText },
    });
    throw new Error(
      response.status >= 500
        ? "Server error. Please try again in a moment."
        : "Something went wrong. Please try again."
    );
  }

  if (!response.ok) {
    const message = data.error || "An error occurred";
    if (response.status >= 500) {
      Sentry.captureMessage(`API ${response.status}: ${endpoint}`, {
        level: "error",
        extra: { error: message },
      });
    }
    if (response.status === 429) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }
    throw new Error(message);
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

  // SECURITY (SEC-005): getBooking now requires a per-booking accessToken
  // returned by createBooking. Without it the backend returns 404, so the
  // caller MUST persist the token from createBooking through the payment /
  // success flow.
  getBooking: (bookingId: string, accessToken: string) =>
    apiFetch<GetBookingResponse>(API_ENDPOINTS.GET_BOOKING, {
      params: { bookingId, token: accessToken },
    }),

  // Classes
  getClasses: () =>
    apiFetch<{ success: boolean; data: ClassSession[] }>(
      API_ENDPOINTS.GET_CLASSES
    ),

  // Events
  getEvents: () =>
    apiFetch<{ success: boolean; data: Event[] }>(API_ENDPOINTS.GET_EVENTS),

  // Contact Enquiry
  createEnquiry: (data: { name: string; email: string; phone?: string; message: string }) =>
    apiFetch<{ success: boolean; data: { id: string } }>(API_ENDPOINTS.CREATE_ENQUIRY, {
      method: "POST",
      body: JSON.stringify(data),
    }),

};

// === Admin API fetch wrapper (auto-injects CSRF token for mutations) ===

// SECURITY (SEC-017): CSRF token is stored in module memory, not in a cookie.
// It's received from the server in login/session-check response bodies.
// XSS cannot read it from document.cookie (there is no csrf_token cookie).
let _csrfToken: string | null = null;

export const setCsrfToken = (token: string | null) => {
  _csrfToken = token;
};

const getCsrfToken = (): string | null => _csrfToken;

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

interface DashboardStats {
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  totalRevenue: number;
  totalClasses: number;
  activeClasses: number;
  totalEvents: number;
  activeEvents: number;
  pendingSpaceRequests: number;
}

export const adminApi = {
  dashboardStats: () =>
    adminApiFetch<{ success: boolean; data: DashboardStats }>(
      API_ENDPOINTS.ADMIN_DASHBOARD_STATS
    ),

  // Auth — login and checkSession capture the CSRF token from the response body
  login: async (email: string, password: string) => {
    const res = await apiFetch<{ success: boolean; data?: { email: string; csrfToken?: string }; error?: string }>(
      API_ENDPOINTS.ADMIN_LOGIN,
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
        credentials: "include",
      }
    );
    if (res.success && res.data?.csrfToken) setCsrfToken(res.data.csrfToken);
    return res;
  },

  checkSession: async () => {
    const res = await apiFetch<{ success: boolean; data?: { email: string; csrfToken?: string }; error?: string }>(
      API_ENDPOINTS.ADMIN_LOGIN,
      {
        credentials: "include",
      }
    );
    if (res.success && res.data?.csrfToken) setCsrfToken(res.data.csrfToken);
    return res;
  },

  logout: async () => {
    const res = await adminApiFetch<{ success: boolean }>(API_ENDPOINTS.ADMIN_LOGOUT, {
      method: "DELETE",
    });
    setCsrfToken(null);
    return res;
  },

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
