import { logError } from "@/lib/sentry";

declare global {
  interface Window {
    SENTRY_DSN?: string;
  }
}

export function reportError(error: Error, errorInfo?: string) {
  logError(error, { componentStack: errorInfo });
}
