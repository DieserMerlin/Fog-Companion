import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import { PropsWithChildren } from "react";
import { MotionConfig } from "motion/react";
import React from "react";
import { CleanCss, motionConfig, theme } from "@diesermerlin/fog-companion-web";
import { WrapTRPC } from "../trpc/trpc";

const bodyTransparentCss = `
body {
  background: transparent !important;
}
`;

const resizeCss = `
  .resize-handle {
    position: absolute;
  z-index: 999999999;
    }

  .top {
    top: -2px;
  left: 8px;
  right: 8px;
  height: 6px;
  cursor: n-resize;
    }

  .bottom {
    bottom: -2px;
  left: 8px;
  right: 8px;
  height: 6px;
  cursor: s-resize;
    }

  .left {
    left: -2px;
  top: 8px;
  bottom: 8px;
  width: 6px;
  cursor: w-resize;
    }

  .right {
    right: -2px;
  top: 8px;
  bottom: 8px;
  width: 6px;
  cursor: e-resize;
    }

  /* corners */
  .tl {
    top: -2px;
  left: -2px;
  width: 12px;
  height: 12px;
  cursor: nwse-resize;
    }

  .tr {
    top: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  cursor: nesw-resize;
    }

  .br {
    bottom: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  cursor: nwse-resize;
    }

  .bl {
    bottom: -2px;
  left: -2px;
  width: 12px;
  height: 12px;
  cursor: nesw-resize;
    }
`;

// ErrorBoundary.tsx
type FallbackRender = (error: Error, info?: React.ErrorInfo) => React.ReactNode;

export interface ErrorBoundaryProps {
  /** Custom fallback UI or a render function that receives the error + component stack. */
  fallback?: React.ReactNode | FallbackRender;
  /** Called when an error is caught (e.g., send to your logging infra). */
  onError?: (error: Error, info: React.ErrorInfo) => void;
  /** Called when the boundary is reset (after a successful retry or resetKeys change). */
  onReset?: () => void;
  /** When any value in this list changes, the boundary will reset itself. */
  resetKeys?: Array<unknown>;
  /** Optional label for the retry button in the default fallback. */
  retryLabel?: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  info?: React.ErrorInfo;
  /** Prevent infinite loops: attempt a single automatic recovery re-render. */
  attemptedRecover: boolean;
  /** Force a remount of children after reset/retry by bumping the key. */
  resetCount: number;
}

function arraysAreEqual(a?: unknown[], b?: unknown[]) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Object.is(a[i], b[i])) continue;
    return false;
  }
  return true;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  static defaultProps = {
    retryLabel: "Try again",
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      attemptedRecover: false,
      resetCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render shows fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Always log to console
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);

    // Optional: send to your logging infra
    this.props.onError?.(error, info);

    // Save the component stack for fallback renderers
    this.setState({ info });
  }

  componentDidUpdate(prevProps: Readonly<ErrorBoundaryProps>, prevState: Readonly<ErrorBoundaryState>) {
    // Attempt one automatic recovery on the first error: clear hasError and re-render.
    // If children still throw, we'll land back in error state due to getDerivedStateFromError.
    if (this.state.hasError && !prevState.hasError && !this.state.attemptedRecover) {
      // Try one immediate re-render
      // (don’t clear error/info so custom fallbacks can still show details if it fails again)
      this.setState({ attemptedRecover: true, hasError: false });
      return;
    }

    // If resetKeys changed, reset the boundary.
    if (!arraysAreEqual(prevProps.resetKeys, this.props.resetKeys)) {
      this.resetErrorBoundary();
    }
  }

  private resetErrorBoundary = () => {
    this.setState((s) => ({
      hasError: false,
      error: undefined,
      info: undefined,
      attemptedRecover: false,
      resetCount: s.resetCount + 1,
    }));
    this.props.onReset?.();
  };

  private handleRetry = () => {
    this.resetErrorBoundary();
  };

  private renderFallback() {
    const { fallback, retryLabel } = this.props;
    const { error, info } = this.state;

    if (typeof fallback === "function") {
      return (fallback as FallbackRender)(error as Error, info);
    }
    if (fallback) return fallback;

    // Default fallback UI
    return (
      <div
        role="alert"
        style={{
          fontFamily: "system-ui, sans-serif",
          padding: "1rem",
          margin: "1rem",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.1)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          background: "white",
        }}
      >
        <h2 style={{ margin: 0, marginBottom: ".5rem" }}>Something went wrong.</h2>
        {process.env.NODE_ENV !== "production" && error ? (
          <details style={{ whiteSpace: "pre-wrap" }}>
            <summary style={{ cursor: "pointer" }}>Error details</summary>
            <div style={{ marginTop: ".5rem" }}>
              <strong>{error.name}: </strong>
              {error.message}
              {info?.componentStack ? (
                <pre style={{ marginTop: ".5rem", overflowX: "auto" }}>
                  {info.componentStack}
                </pre>
              ) : null}
            </div>
          </details>
        ) : null}
        <button
          type="button"
          onClick={this.handleRetry}
          style={{
            marginTop: "0.75rem",
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "#f6f6f6",
            cursor: "pointer",
          }}
        >
          {retryLabel}
        </button>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.renderFallback();
    }

    // Force remount after a reset/retry to clear child component state
    return <React.Fragment key={this.state.resetCount}>{this.props.children}</React.Fragment>;
  }
}

export const BaseWindow = (props: PropsWithChildren<{ transparent?: boolean, fullWindowDrag?: boolean, resizable?: boolean }>) => {
  return (
    <ErrorBoundary>
      {props.resizable && <>
        <GlobalStyles styles={resizeCss} />
        <div id="resize">
          <div className="resize-handle top" data-edge="Top"></div>
          <div className="resize-handle right" data-edge="Right"></div>
          <div className="resize-handle bottom" data-edge="Bottom"></div>
          <div className="resize-handle left" data-edge="Left"></div>
          <div className="resize-handle tl" data-edge="TopLeft"></div>
          <div className="resize-handle tr" data-edge="TopRight"></div>
          <div className="resize-handle br" data-edge="BottomRight"></div>
          <div className="resize-handle bl" data-edge="BottomLeft"></div>
        </div>
      </>}
      {props.fullWindowDrag && <div style={{
        position: 'fixed',
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        zIndex: 999999,
      }} id="header" />}
      <MotionConfig {...motionConfig}>
        <ThemeProvider theme={theme}>
          <WrapTRPC>
            <CssBaseline />
            <GlobalStyles styles={CleanCss} />
            {props.transparent && <GlobalStyles styles={bodyTransparentCss} />}
            {props.children}
          </WrapTRPC>
        </ThemeProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}