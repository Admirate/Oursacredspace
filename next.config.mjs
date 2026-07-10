import { withSentryConfig } from "@sentry/nextjs";

// SECURITY (SEC-015): The Content-Security-Policy lives here — not in
// netlify.toml — because it must differ by environment, which a static
// netlify.toml header cannot express.
//
// React and Turbopack require eval() in DEVELOPMENT for debugging (source
// maps, callstack reconstruction). React NEVER uses eval() in production, so
// 'unsafe-eval' is added only in dev. Keeping it out of the production policy
// preserves the SEC-015 hardening. HMR also needs a localhost websocket in dev.
const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://checkout.razorpay.com https://*.razorpay.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https: blob:",
  "media-src 'self' https://*.supabase.co blob:",
  `connect-src 'self' https://*.supabase.co https://*.razorpay.com wss://*.supabase.co${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  "frame-src https://api.razorpay.com https://checkout.razorpay.com https://www.openstreetmap.org https://www.google.com https://maps.google.com",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Required for Netlify deployment
  output: 'standalone',
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry organization + project (set via env or fill in manually)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps only in CI/production builds
  silent: true,
  widenClientFileUpload: true,

  // Disable automatic instrumentation of API routes (we use Netlify Functions)
  autoInstrumentServerFunctions: false,

  // Suppress build-time Sentry warnings if DSN not yet configured
  disableLogger: true,
});
