import { Component, ErrorInfo, ReactNode } from 'react';
import Button from './Button';
import Card from './Card';

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
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#faf9f6]">
          <Card variant="solid" className="max-w-2xl border-2 border-red-300">
            <h2 className="text-2xl font-semibold text-red-700 mb-4">
              Dashboard Error
            </h2>
            <p className="text-[#6b6560] mb-4 font-medium">
              An unexpected error occurred in the dashboard. Please try refreshing the page.
            </p>
            {this.state.error && (
              <Card variant="default" className="mb-4">
                <div className="text-red-700 mb-2 font-semibold">Error:</div>
                <div className="text-[#2d2926] font-mono">{this.state.error.message}</div>
                {process.env.NODE_ENV === 'development' && this.state.error.stack && (
                  <details className="mt-2">
                    <summary className="text-[#6b6560] cursor-pointer font-medium">Stack trace</summary>
                    <pre className="mt-2 text-xs overflow-auto text-[#6b6560] font-mono p-3 bg-[#f5f3f0] border border-[#e8e4e0] rounded-xl">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </Card>
            )}
            <div className="flex gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={this.handleReset}
              >
                Try Again
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
