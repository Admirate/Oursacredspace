"use client";

import { useEffect } from "react";
import { RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen bg-sacred-cream flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="mb-6 flex justify-center">
            <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center">
              <span className="text-4xl">⚠️</span>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-sacred-burgundy mb-3">
            Something went wrong
          </h1>
          <p className="text-gray-500 mb-2 leading-relaxed">
            An unexpected error occurred. Please try again or return to the home page.
          </p>
          {error.digest && (
            <p className="text-xs text-gray-400 font-mono mb-6">
              Error ID: {error.digest}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
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
              Back to Home
            </Link>
          </div>

          <p className="mt-10 text-xs text-gray-400">
            Our Sacred Space · Secunderabad
          </p>
        </div>
      </body>
    </html>
  );
}
