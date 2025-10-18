import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import { PropsWithChildren } from "react";
import { theme } from "../mui/theme";
import { MotionConfig } from "motion/react";
import React from "react";

const cleanCss = `
body {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  -moz-backface-visibility: hidden;
}


* {
  scrollbar-width: none; /* Firefox */
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}


img {
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
  user-drag: none;
}

input, textarea /*.contenteditable?*/
{
  -webkit-touch-callout: default;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}

*::-webkit-scrollbar {
  display: none; /* Safari and Chrome */
}
`;

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

/**
* Minimal Error Boundary that logs errors to the console
* and *does not* render a fallback UI. This preserves the
* last successfully committed UI so your app "continues to render
* as before" after an error is caught.
*/
export class ErrorBoundary extends React.Component {
  componentDidCatch(error, info) {
    // Send this to your logging infra if desired
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    // @ts-expect-error No fallback UI — keep rendering children as-is
    return this.props.children;
  }
}


export default ErrorBoundary;

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
      <MotionConfig transition={{ duration: .3, ease: [.29, .29, .17, 1] }}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <GlobalStyles styles={cleanCss} />
          {props.transparent && <GlobalStyles styles={bodyTransparentCss} />}
          {props.children}
        </ThemeProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}