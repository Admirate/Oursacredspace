"use client";

import { useEffect } from "react";
import { RefreshCw, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { ADMIN_ROUTE_PREFIX } from "@/lib/constants";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin panel error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
            <span className="text-4xl">⚠️</span>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-sacred-burgundy mb-3">
          Admin Panel Error
        </h2>
        <p className="text-gray-500 mb-2 leading-relaxed">
          An unexpected error occurred in the admin panel.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono mb-6">
            Ref: {error.digest}
          </p>
        )}
        {process.env.NODE_ENV === "development" && error.message && (
          <pre className="text-left text-xs bg-gray-100 rounded-lg p-3 mb-6 overflow-auto max-h-32 text-red-600">
            {error.message}
          </pre>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-sacred-green text-white rounded-full font-medium hover:bg-sacred-green/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <Link
            href={ADMIN_ROUTE_PREFIX}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-sacred-green text-sacred-green rounded-full font-medium hover:bg-sacred-green/5 transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
