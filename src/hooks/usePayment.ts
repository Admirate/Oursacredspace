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
  // True from the moment the Razorpay modal reports success until we finish
  // server-side verification and redirect. Drives the "Confirming your
  // payment…" overlay so the user isn't left staring at a blank page.
  isVerifying: boolean;
  error: string | null;
}

export const usePayment = (options: UsePaymentOptions = {}) => {
  const router = useRouter();
  const inFlightRef = useRef(false);
  const [state, setState] = useState<PaymentState>({
    isLoading: false,
    isCreatingOrder: false,
    isVerifying: false,
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
    // SECURITY (SEC-006): accessToken from createBooking is now required
    // to create a Razorpay order and to fetch the booking on the success
    // page. Callers MUST pass the token returned by createBooking.
    async (bookingId: string, accessToken: string) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setState((prev) => ({ ...prev, isLoading: true, isVerifying: false, error: null }));

      try {
        // Load Razorpay script
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          throw new Error("Failed to load payment gateway. Please try again.");
        }

        // Create Razorpay order
        setState((prev) => ({ ...prev, isCreatingOrder: true }));
        const orderResponse = await api.createRazorpayOrder({ bookingId, accessToken });

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
          // SECURITY: Razorpay's Standard Checkout integration mandates
          // server-side verification of the (order_id, payment_id,
          // signature) triple. We POST it to /verifyPayment, which
          // recomputes HMAC-SHA256 and confirms the booking on match.
          // Only after that succeeds do we redirect — this protects
          // against client-side handler tampering and removes the
          // dependency on webhook latency for the user-facing flow.
          handler: async (response: RazorpaySuccessResponse) => {
            // Modal has closed and payment succeeded; show the verifying
            // overlay while we confirm server-side.
            setState((prev) => ({ ...prev, isVerifying: true }));
            try {
              const verifyResult = await api.verifyPayment({
                bookingId,
                accessToken,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });

              if (!verifyResult.success) {
                throw new Error(
                  verifyResult.error || "Payment verification failed"
                );
              }

              inFlightRef.current = false;
              options.onSuccess?.(response);
              router.push(
                `/success?bookingId=${encodeURIComponent(bookingId)}&token=${encodeURIComponent(accessToken)}`
              );
            } catch (verifyError) {
              inFlightRef.current = false;
              const msg =
                verifyError instanceof Error
                  ? verifyError.message
                  : "Payment verification failed. If you were charged, contact support.";
              Sentry.captureException(verifyError, {
                tags: { flow: "payment_verify" },
                extra: { bookingId, orderId: response.razorpay_order_id },
              });
              setState((prev) => ({ ...prev, isLoading: false, isVerifying: false, error: msg }));
              options.onError?.(verifyError instanceof Error ? verifyError : new Error(msg));
            }
          },
          modal: {
            // confirm_close shows a "Are you sure?" prompt when the user
            // tries to close the checkout — reduces accidental drop-offs.
            confirm_close: true,
            escape: false,
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
          // Auto-close the checkout after 4 minutes. This MUST stay below the
          // server-side unpaid-booking expiry window (pg_cron expires
          // PENDING_PAYMENT bookings after 5 min). If checkout outlived that
          // window, a payment could capture against an already-EXPIRED booking
          // and the confirmation path would skip it — charging the customer
          // without confirming. Keep checkout timeout < expiry window.
          timeout: 240,
          notes: {
            bookingId,
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
          isVerifying: false,
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
