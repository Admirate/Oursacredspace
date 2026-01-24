"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { RAZORPAY_CONFIG } from "@/lib/constants";
import type { RazorpayOptions, RazorpaySuccessResponse } from "@/types";

interface UsePaymentOptions {
  onSuccess?: (response: RazorpaySuccessResponse) => void;
  onError?: (error: Error) => void;
}

interface PaymentState {
  isLoading: boolean;
  isCreatingOrder: boolean;
  error: string | null;
}

export const usePayment = (options: UsePaymentOptions = {}) => {
  const router = useRouter();
  const [state, setState] = useState<PaymentState>({
    isLoading: false,
    isCreatingOrder: false,
    error: null,
  });

  const loadRazorpayScript = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  const initiatePayment = useCallback(
    async (bookingId: string) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Load Razorpay script
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          throw new Error("Failed to load payment gateway. Please try again.");
        }

        // Create Razorpay order
        setState((prev) => ({ ...prev, isCreatingOrder: true }));
        const orderResponse = await api.createRazorpayOrder({ bookingId });

        if (!orderResponse.success || !orderResponse.data) {
          throw new Error(orderResponse.error || "Failed to create payment order");
        }

        const { orderId, keyId, amount, currency, customerName, customerEmail, customerPhone } =
          orderResponse.data;

        setState((prev) => ({ ...prev, isCreatingOrder: false }));

        // Open Razorpay checkout
        const razorpayOptions: RazorpayOptions = {
          key: keyId,
          amount,
          currency,
          name: RAZORPAY_CONFIG.name,
          description: RAZORPAY_CONFIG.description,
          order_id: orderId,
          prefill: {
            name: customerName,
            email: customerEmail,
            contact: customerPhone,
          },
          theme: RAZORPAY_CONFIG.theme,
          handler: (response: RazorpaySuccessResponse) => {
            // Payment successful - redirect to success page
            options.onSuccess?.(response);
            router.push(`/success?bookingId=${bookingId}`);
          },
          modal: {
            ondismiss: () => {
              setState((prev) => ({
                ...prev,
                isLoading: false,
                error: "Payment cancelled",
              }));
            },
          },
        };

        const razorpay = new window.Razorpay(razorpayOptions);
        razorpay.open();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Payment failed. Please try again.";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isCreatingOrder: false,
          error: errorMessage,
        }));
        options.onError?.(error instanceof Error ? error : new Error(errorMessage));
      }
    },
    [loadRazorpayScript, options, router]
  );

  const resetError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    initiatePayment,
    resetError,
  };
};
