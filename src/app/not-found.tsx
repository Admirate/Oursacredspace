"use client";

import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-sacred-cream flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="w-24 h-24 rounded-full bg-sacred-green/10 flex items-center justify-center">
            <span className="text-5xl font-bold text-sacred-green">404</span>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-sacred-burgundy mb-3">
          Page Not Found
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-sacred-green text-white rounded-full font-medium hover:bg-sacred-green/90 transition-colors"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-sacred-green text-sacred-green rounded-full font-medium hover:bg-sacred-green/5 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </div>

        <p className="mt-10 text-xs text-gray-400">
          Our Sacred Space · Secunderabad
        </p>
      </div>
    </div>
  );
}
