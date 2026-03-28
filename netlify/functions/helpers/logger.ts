import * as Sentry from "@sentry/node";
import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from "@netlify/functions";

let sentryInitialized = false;

const initSentry = (): boolean => {
  if (sentryInitialized) return true;
  if (!process.env.SENTRY_DSN) return false;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    release: process.env.DEPLOY_ID,
  });

  sentryInitialized = true;
  return true;
};

type LogLevel = "info" | "warn" | "error" | "security";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  env: string;
  [key: string]: unknown;
}

const emit = (level: LogLevel, message: string, data?: Record<string, unknown>): void => {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: "netlify-functions",
    env: process.env.NODE_ENV || "development",
    ...data,
  };

  const line = JSON.stringify(entry);

  if (level === "error" || level === "security") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
};

export const logger = {
  info: (message: string, data?: Record<string, unknown>): void => {
    emit("info", message, data);
  },

  warn: (message: string, data?: Record<string, unknown>): void => {
    emit("warn", message, data);
    if (initSentry()) {
      Sentry.captureMessage(message, { level: "warning", extra: data });
    }
  },

  error: (message: string, error?: unknown, data?: Record<string, unknown>): void => {
    const errorData: Record<string, unknown> = {
      ...data,
      ...(error instanceof Error && {
        errorMessage: error.message,
        errorName: error.name,
        ...(process.env.NODE_ENV !== "production" && { errorStack: error.stack }),
      }),
      ...(typeof error === "string" && { errorMessage: error }),
    };

    emit("error", message, errorData);

    if (initSentry()) {
      if (error instanceof Error) {
        Sentry.captureException(error, { extra: { ...data, logMessage: message } });
      } else {
        Sentry.captureMessage(message, { level: "error", extra: errorData });
      }
    }
  },

  security: (
    type: string,
    details: Record<string, unknown>
  ): void => {
    emit("security", type, details);

    if (initSentry()) {
      Sentry.captureMessage(`[SECURITY] ${type}`, {
        level: "warning",
        extra: details,
        tags: { security_event: type },
        fingerprint: ["security", type],
      });
    }
  },

  payment: (
    event: "captured" | "failed" | "anomaly",
    details: Record<string, unknown>
  ): void => {
    const level = event === "anomaly" ? "security" : "info";
    emit(level, `payment.${event}`, details);

    if (initSentry()) {
      if (event === "anomaly") {
        Sentry.captureMessage(`[PAYMENT ANOMALY] ${details.type || "unknown"}`, {
          level: "error",
          extra: details,
          tags: { payment_event: event },
          fingerprint: ["payment", "anomaly", String(details.type ?? "")],
        });
      } else if (event === "failed") {
        Sentry.captureMessage(`payment.failed`, {
          level: "warning",
          extra: details,
          tags: { payment_event: event },
        });
      }
    }
  },

  flush: async (): Promise<void> => {
    if (sentryInitialized) {
      await Sentry.flush(2000);
    }
  },
};

/**
 * Wraps a Netlify Function handler with Sentry error capture and flush.
 * Catches unhandled exceptions, captures them, and returns a clean 500.
 * IMPORTANT: Apply to high-value handlers (payment, auth, booking).
 */
export const withSentry = (name: string, handler: Handler): Handler => {
  const wrapped = async (
    event: HandlerEvent,
    context: HandlerContext
  ): Promise<HandlerResponse> => {
    if (initSentry()) {
      Sentry.setTag("function", name);
      Sentry.setExtra("httpMethod", event.httpMethod);
      Sentry.setExtra("path", event.path);
    }

    try {
      const result = await handler(event, context);
      await logger.flush();
      return result ?? { statusCode: 200, body: "" };
    } catch (error) {
      logger.error(`Unhandled exception in ${name}`, error, {
        path: event.path,
        method: event.httpMethod,
      });
      await logger.flush();
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: "Internal server error" }),
      };
    }
  };
  return wrapped;
};
