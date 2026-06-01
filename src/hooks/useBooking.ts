"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { POLLING_INTERVAL, POLLING_MAX_ATTEMPTS } from "@/lib/constants";
import type {
  CreateBookingRequest,
  Booking,
  BookingType,
  BookingStatus,
} from "@/types";

// === Create Booking Hook ===

interface UseCreateBookingOptions {
  onSuccess?: (bookingId: string) => void;
  onError?: (error: Error) => void;
}

export const useCreateBooking = (options: UseCreateBookingOptions = {}) => {
  const mutation = useMutation({
    mutationFn: async (data: CreateBookingRequest) => {
      const response = await api.createBooking(data);
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to create booking");
      }
      return response.data;
    },
    onSuccess: (data) => {
      options.onSuccess?.(data.bookingId);
    },
    onError: (error: Error) => {
      options.onError?.(error);
    },
  });

  return {
    createBooking: mutation.mutate,
    createBookingAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
};

// === Get Booking Hook ===

// SECURITY (SEC-005): getBooking now requires the per-booking accessToken
// returned by createBooking. Both bookingId and accessToken must be present
// for the hook to fire.
export const useBooking = (
  bookingId: string | null,
  accessToken: string | null,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ["booking", bookingId, accessToken],
    queryFn: async () => {
      if (!bookingId || !accessToken) return null;
      const response = await api.getBooking(bookingId, accessToken);
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch booking");
      }
      return response.data;
    },
    enabled: !!bookingId && !!accessToken && (options?.enabled !== false),
  });
};

// === Poll Booking Status Hook ===

interface UsePollBookingOptions {
  onConfirmed?: (booking: Booking) => void;
  onFailed?: () => void;
  onTimeout?: () => void;
}

export const usePollBookingStatus = (
  bookingId: string | null,
  accessToken: string | null,
  options: UsePollBookingOptions = {}
) => {
  const [pollCount, setPollCount] = useState(0);
  const [status, setStatus] = useState<"polling" | "confirmed" | "failed" | "timeout">("polling");

  const query = useQuery({
    queryKey: ["booking", bookingId, accessToken, "poll"],
    queryFn: async () => {
      if (!bookingId || !accessToken) return null;
      const response = await api.getBooking(bookingId, accessToken);
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch booking");
      }
      return response.data;
    },
    enabled: !!bookingId && !!accessToken && status === "polling",
    refetchInterval: (query) => {
      const booking = query.state.data as Booking | null | undefined;
      if (!booking) return POLLING_INTERVAL;
      
      // Stop polling if confirmed
      if (booking.status === "CONFIRMED") {
        setStatus("confirmed");
        options.onConfirmed?.(booking);
        return false;
      }
      
      // Stop polling if failed
      if (booking.status === "PAYMENT_FAILED") {
        setStatus("failed");
        options.onFailed?.();
        return false;
      }

      // Increment poll count
      setPollCount((prev) => {
        const newCount = prev + 1;
        if (newCount >= POLLING_MAX_ATTEMPTS) {
          setStatus("timeout");
          options.onTimeout?.();
          return prev;
        }
        return newCount;
      });

      return POLLING_INTERVAL;
    },
  });

  const reset = useCallback(() => {
    setPollCount(0);
    setStatus("polling");
  }, []);

  return {
    booking: query.data,
    status,
    pollCount,
    reset,
    isLoading: query.isLoading,
    error: query.error,
  };
};

// === Get Classes Hook ===

export const useClasses = () => {
  return useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const response = await api.getClasses();
      if (!response.success) {
        throw new Error("Failed to fetch classes");
      }
      return response.data;
    },
  });
};

// === Get Events Hook ===

export const useEvents = () => {
  return useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const response = await api.getEvents();
      if (!response.success) {
        throw new Error("Failed to fetch events");
      }
      return response.data;
    },
  });
};

