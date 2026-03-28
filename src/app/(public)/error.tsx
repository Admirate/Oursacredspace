"use client";

import { useEffect } from "react";
import { RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Public route error:", error);
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
          Something went wrong
        </h2>
        <p className="text-gray-500 mb-6 leading-relaxed">
          We couldn&apos;t load this page. This is usually temporary — please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono mb-4">
            Ref: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-sacred-green text-white rounded-full font-medium hover:bg-sacred-green/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-sacred-green text-sacred-green rounded-full font-medium hover:bg-sacred-green/5 transition-colors"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
