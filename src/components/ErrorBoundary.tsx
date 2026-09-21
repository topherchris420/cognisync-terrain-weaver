import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Catches render-time exceptions anywhere in the
 * route tree and shows a recoverable fallback instead of a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-destructive" />
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An unexpected error interrupted rendering. Your data is safe — try
            reloading the view.
          </p>
          <p className="mt-3 rounded-md bg-muted/60 p-2 font-mono text-xs text-muted-foreground break-words">
            {this.state.error.message}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={this.reset} variant="outline" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
            <Button onClick={() => window.location.assign("/")}>
              Back to home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
