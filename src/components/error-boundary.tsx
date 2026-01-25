"use client";

import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { reportError } from "@/lib/sentry-client";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ReactNode | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: string) => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    reportError(error, errorInfo.componentStack);

    if (this.props.onError) {
      this.props.onError(error, errorInfo.componentStack || "");
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Виникла помилка</h2>
          <p className="text-muted-foreground mb-4 max-w-md">
            Сталася непередбачена помилка. Спробуйте перезавантажити сторінку.
          </p>
          {this.state.error && process.env.NODE_ENV === "development" && (
            <pre className="text-xs text-left p-4 bg-muted rounded-lg overflow-auto max-w-md max-h-32 mb-4">
              {this.state.error.message}
            </pre>
          )}
          <Button onClick={this.handleReset} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Перезавантажити
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: string) => void
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback} onError={onError}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
