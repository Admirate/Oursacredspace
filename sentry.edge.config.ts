import * as Sentry from "@sentry/nextjs";

// Only initialize Sentry in production (see sentry.server.config.ts for why).
if (process.env.SENTRY_DSN && process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
