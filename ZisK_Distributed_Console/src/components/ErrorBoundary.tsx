import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-neutral-light text-gray-900 p-4 flex items-center justify-center">
          <div className="max-w-2xl bg-white border-2 border-primary rounded-4xl p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-primary mb-4">
              Dashboard Error
            </h2>
            <p className="text-gray-900 mb-4">
              An unexpected error occurred in the dashboard. Please try refreshing the page.
            </p>
            {this.state.error && (
              <div className="mb-4 p-3 bg-neutral-light rounded-3xl text-sm border border-neutral">
                <div className="text-primary mb-2 font-semibold">Error:</div>
                <div className="text-gray-900">{this.state.error.message}</div>
                {process.env.NODE_ENV === 'development' && this.state.error.stack && (
                  <details className="mt-2">
                    <summary className="text-gray-900 cursor-pointer font-medium">Stack trace</summary>
                    <pre className="mt-2 text-xs overflow-auto text-gray-800">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-3xl font-medium text-sm"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="ml-2 px-4 py-2 bg-primary-light/30 hover:bg-primary-light/50 text-gray-900 rounded-3xl font-medium text-sm"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

