"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
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
  const inFlightRef = useRef(false);
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

      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );
      if (existingScript) {
        existingScript.onload = () => resolve(true);
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
      if (inFlightRef.current) return;
      inFlightRef.current = true;
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
            inFlightRef.current = false;
            options.onSuccess?.(response);
            router.push(`/success?bookingId=${bookingId}`);
          },
          modal: {
            ondismiss: () => {
              inFlightRef.current = false;
              setState((prev) => ({
                ...prev,
                isLoading: false,
                error: "Payment cancelled",
              }));
              options.onError?.(new Error("Payment cancelled. You can retry from the booking page."));
            },
          },
        };

        const razorpay = new window.Razorpay(razorpayOptions);
        razorpay.on("payment.failed", (resp: { error?: { description?: string; reason?: string; code?: string } }) => {
          const desc = resp?.error?.description || "Payment failed";
          Sentry.captureMessage("Razorpay payment.failed", {
            level: "warning",
            extra: { bookingId, reason: resp?.error?.reason, code: resp?.error?.code },
          });
          setState((prev) => ({ ...prev, error: desc }));
          options.onError?.(new Error(desc));
        });
        razorpay.open();
      } catch (error) {
        inFlightRef.current = false;
        const errorMessage =
          error instanceof Error ? error.message : "Payment failed. Please try again.";
        Sentry.captureException(error, { tags: { flow: "payment" } });
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
