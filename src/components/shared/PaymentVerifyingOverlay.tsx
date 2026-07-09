"use client";

import { Loader2 } from "lucide-react";

/**
 * Full-screen overlay shown after the Razorpay modal closes while the payment
 * is being verified server-side. Without it, the checkout modal disappears and
 * the user is left on the previous page with no feedback for a few seconds
 * before the redirect to /success.
 */
export function PaymentVerifyingOverlay({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="alertdialog"
      aria-live="assertive"
      aria-busy="true"
      aria-label="Confirming your payment"
    >
      <div className="mx-4 flex max-w-sm flex-col items-center gap-4 rounded-2xl bg-white px-8 py-10 text-center shadow-2xl">
        <Loader2 className="h-12 w-12 animate-spin text-sacred-green" />
        <div>
          <h2 className="text-xl font-semibold text-sacred-burgundy">
            Confirming your payment
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Please don&apos;t close or refresh this page. This only takes a moment&hellip;
          </p>
        </div>
      </div>
    </div>
  );
}
