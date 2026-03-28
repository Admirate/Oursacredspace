import { withSentryConfig } from "@sentry/nextjs";

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
