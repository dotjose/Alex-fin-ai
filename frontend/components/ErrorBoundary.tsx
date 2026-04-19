import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
          <div className="max-w-md text-center">
            <h1 className="mb-4 text-2xl font-bold text-[var(--danger)] sm:text-3xl">
              Something went wrong
            </h1>
            <p className="mb-6 text-[var(--text-secondary)]">
              An unexpected error occurred. The error has been logged and we&apos;ll look into it.
            </p>
            {this.state.error && (
              <details className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left text-[var(--text-primary)]">
                <summary className="cursor-pointer font-medium text-[var(--text-primary)]">
                  Error details
                </summary>
                <pre className="mt-2 overflow-auto text-xs text-[var(--text-secondary)]">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-white transition hover:opacity-95"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}