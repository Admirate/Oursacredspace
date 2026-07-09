import * as Sentry from "@sentry/nextjs";

// Only initialize Sentry in production. In local dev (e.g. under `netlify dev`)
// Sentry's HTTP server auto-instrumentation recursively patches
// TCP.onconnection and crashes the process on newer Node versions.
if (process.env.SENTRY_DSN && process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
