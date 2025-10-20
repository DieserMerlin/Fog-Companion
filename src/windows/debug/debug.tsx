
import { createRoot } from "react-dom/client";
import { AppWindow } from "../../AppWindow";
import { kWindowNames } from "../../consts";
import { GameStateGuesser } from "../../game_state/GameState";
import { OcrAreasResult, OCRSingleResult, PureBlackResult } from "../../utils/ocr/area-ocr";
import { BaseWindow } from "../../utils/window/AppWindow";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import { create } from "zustand";
import Box from "@mui/material/Box";
import { useLayoutEffect, useRef } from "react";
import { useGameState } from "../../utils/hooks/gamestate-hook";

const cache = overwolf.windows.getMainWindow().cache;
const canvas: any = (cache.canvas = ({}));

class Debug extends AppWindow {
  private static _instance: Debug;
  private currentMapImg: string | null = null;

  private constructor() {
    super(kWindowNames.debug);
  }

  private guesser = new GameStateGuesser();

  public static instance() {
    if (!this._instance) {
      this._instance = new Debug();
    }

    return this._instance;
  }
}

Debug.instance();

const useOcrRes = create<{ [key: string]: OCRSingleResult | PureBlackResult }>(set => ({}));
overwolf.windows.getMainWindow().bus.on('ocr-res', res => useOcrRes.setState({ ...res }));

const useOcrDecision = create<{ id: string }>(set => ({ id: '' }));
overwolf.windows.getMainWindow().bus.on('ocr-decision', id => useOcrDecision.setState({ id }));

type Props = { id: string };


const CanvasDisplay: React.FC<Props> = ({ id }) => {
  const res = useOcrRes((s) => s[id]);
  const active = useOcrDecision(s => s.id === id);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Optional: ensure the canvas element has intrinsic pixel size (width/height attributes).
  // This helps object-fit preserve the aspect ratio correctly.
  useLayoutEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    // If your drawing code already sets c.width/c.height, you can skip this.
    // Here we default to a sane intrinsic size if missing.
    if (!c.width || !c.height) {
      c.width = 800;   // intrinsic pixel width
      c.height = 600;  // intrinsic pixel height (4:3 as a fallback)
    }
  }, []);

  return (
    <Grid
      // outer container controls layout
      size={{ xs: 12, md: 12, lg: 6 }}
      sx={{
        width: '100%',
        display: "flex",
        gap: 2,
        alignItems: "stretch",
        // stack on small screens
        flexDirection: { xs: "column", sm: "row" },
      }}
    >
      {/* Canvas pane (70% width, fixed aspect ratio) */}
      <Box
        sx={{
          flexBasis: { sm: "70%" },
          flexGrow: 0,
          flexShrink: 0,
          height: 'calc(70vw * 1/3)',
          position: "relative",
          borderRadius: 1,
          border: active ? "3px solid" : "1px solid",
          borderColor: active ? 'green' : "divider",
          overflow: "hidden",
          backgroundColor: "background.paper",
        }}
      >
        {/* Optional label */}
        <Box
          component="span"
          sx={{
            position: "absolute",
            top: 8,
            left: 8,
            px: 1,
            py: 0.25,
            fontSize: 12,
            lineHeight: 1,
            borderRadius: 1,
            bgcolor: "background.default",
            color: "text.primary",
            zIndex: 1,
          }}
        >
          {id}
        </Box>

        {/* The canvas fills this box but preserves its intrinsic aspect via object-fit */}
        <Box
          component="canvas"
          ref={(el: HTMLCanvasElement | null) => {
            canvasRef.current = el;
            canvas[id] = el || null;
          }}
          sx={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "contain",
            // Ensure the canvas content is centered when letterboxed/pillarboxed
            objectPosition: "center center",
            backgroundColor: "black", // makes the letterbox visible; tweak if desired
          }}
        />
      </Box>

      {/* JSON pane (remaining width, scrolls if long) */}
      <Box
        sx={{
          flexBasis: { sm: "30%" },
          flexGrow: 1,
          minWidth: 0, // important so long content doesn't force overflow
          maxHeight: { xs: 300, sm: 400 }, // match/compliment canvas height
          overflow: "auto",
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          backgroundColor: "black",
          color: "white",
          fontFamily: "monospace",
          fontSize: 12,
          p: 1.5,
          whiteSpace: "pre", // preserve formatting like <pre>
        }}
        component="pre"
      >
        {JSON.stringify(res, null, 2)}
      </Box>
    </Grid>
  );
};

const AppState = () => {
  return <Grid size={{ xs: 12, md: 12, lg: 6 }}>
    <pre style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      {JSON.stringify(useGameState(), null, 2)}
    </pre>
  </Grid>;
}

const App = () => (
  <BaseWindow resizable fullWindowDrag>
    <pre id="output"></pre>
    <Grid container spacing={1} width={'100%'} height={'100%'}>
      <CanvasDisplay id="map" />
      <CanvasDisplay id="main-menu" />
      <CanvasDisplay id="menu-btn" />
      <CanvasDisplay id="bloodpoints" />
      <CanvasDisplay id="loading-screen" />
      <CanvasDisplay id="loading-text" />
      <CanvasDisplay id="settings" />
      <AppState />
    </Grid>
  </BaseWindow>
);

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
