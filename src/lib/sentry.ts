import { init, captureException } from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV || "development",
  });
}

export function logError(error: Error, context?: Record<string, unknown>) {
  if (SENTRY_DSN) {
    captureException(error, { extra: context });
  } else {
    console.error("Error:", error.message, context);
  }
}

export function logInfo(message: string, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.log(message, context);
  }
}
