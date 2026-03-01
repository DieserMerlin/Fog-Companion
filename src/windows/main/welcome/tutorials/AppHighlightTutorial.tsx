import {
  ArrowBack,
  ArrowBackIos,
  ArrowDownward,
  ArrowForward,
  ArrowForwardIos,
  ArrowUpward,
  Search,
} from "@mui/icons-material";
import {
  Backdrop,
  Box,
  Button,
  GlobalStyles,
  Link,
  Portal,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { AnimatePresence, motion } from "motion/react";
import {
  PropsWithChildren,
  ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState
} from "react";
import { create } from "zustand";
import { useMainApp } from "../../use-main-app";
import { useTutorial } from "./AppTutorial";

const HIGHLIGHT_MARGIN = 10;

const MotionStack = motion.create(Stack);
const MotionBox = motion.create(Box);

type Props = {
  hltId: string;
  children: (
    key: string,
    setRef: (el: HTMLElement | null) => void,
    highlighted: boolean
  ) => React.ReactNode;
  clickable?: true;
  title: string;
  content: ReactNode;
  contentPosition: "above" | "below" | "left" | "right" | "above-left" | "above-right" | "below-left" | "below-right";
  ignore?: boolean;
  contentWidth?: number | string;
};

type RectLike = { top: number; left: number; right: number; bottom: number; width: number; height: number };

type LastOverlayState = {
  rect: RectLike;
  tooltip: { left: number; top: number, x: string, y: string };
} | null;

export const HLTElement =
  ({ children, hltId, clickable, title, content, contentPosition, contentWidth, ignore }: Props) => {
    if (ignore) return children(hltId, () => { }, false);

    const highlighted = useHighlightTutorial((s) => s.sequence?.[s.current ?? 0] === hltId);

    useEffect(() => {
      useAvailableHighlightElements.setState({ [hltId]: true });
      return () =>
        useAvailableHighlightElements.setState({ [hltId]: null });
    }, [hltId]);

    const [elementRef, setElementRef] = useState<HTMLElement | null>(null);
    const [rect, setRect] = useState<RectLike | null>(null);

    const setLast = useHighlightTutorial((s) => s.setLast);

    // Measure the actual DOM element (provided via setRef)
    useLayoutEffect(() => {
      if (!highlighted || !elementRef) {
        setRect(null);
        return;
      }

      const measure = () => {
        const r = elementRef.getBoundingClientRect();
        setRect({
          top: r.top,
          left: r.left,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        });
      };

      measure();
      window.addEventListener("resize", measure);
      window.addEventListener("scroll", measure, true);
      return () => {
        window.removeEventListener("resize", measure);
        window.removeEventListener("scroll", measure, true);
      };
    }, [highlighted, elementRef]);

    // Compute tooltip anchor position (with transform for alignment)
    const position = useMemo(() => {
      if (!rect) return { top: 0, left: 0, transform: "none" };

      const margin = 12;

      switch (contentPosition) {
        case "above":
          return {
            left: rect.left + rect.width / 2,
            top: rect.top - margin,
            x: '-50%',
            y: '-100%',
          };

        case "below":
          return {
            left: rect.left + rect.width / 2,
            top: rect.top + rect.height + margin,
            x: '-50%',
            y: '0%',
          };

        case "left":
          return {
            left: rect.left - margin,
            top: rect.top + rect.height / 2,
            x: '-100%',
            y: '-50%',
          };

        case "right":
          return {
            left: rect.left + rect.width + margin,
            top: rect.top + rect.height / 2,
            transform: "translate(0%, -50%)",
            x: '0%',
            y: '-50%',
          };

        case "above-left":
          return {
            left: rect.left - margin,
            top: rect.top - margin,
            x: '-100%',
            y: '-100%',
          };

        case "above-right":
          return {
            left: rect.right + margin,
            top: rect.top - margin,
            x: '0%',
            y: '-100%',
          };

        case "below-left":
          return {
            left: rect.left - margin,
            top: rect.top + rect.height + margin,
            x: '-100%',
            y: '0%',
          };

        case "below-right":
          return {
            left: rect.right + margin,
            top: rect.bottom + margin,
            x: '0%',
            y: '0%',
          };
      }
    }, [contentPosition, rect]);

    // When this step stops being highlighted (unmounted or toggled),
    // remember its rect + tooltip position so the next step can animate from it.
    useEffect(() => {
      if (!highlighted || !rect || !position) return;

      return () => {
        setLast({
          rect,
          tooltip: { left: position.left, top: position.top, x: position.x, y: position.y },
        });
      };
    }, [highlighted, rect, position, setLast]);

    const clear = useHighlightTutorial((s) => s.clear);
    const next = useHighlightTutorial((s) => s.next);
    const prev = useHighlightTutorial((s) => s.prev);
    const isLast = useHighlightTutorial((s) => (s.current || 0) === (s.sequence?.length || 1) - 1);
    const isFirst = useHighlightTutorial((s) => (s.current ?? 1) === 0);
    const last = useHighlightTutorial((s) => s.last);

    const controls = useMemo(
      () => (
        <Stack spacing={0.5} alignItems={"center"} justifyContent={"center"}>
          <Button
            fullWidth
            onClick={next}
            sx={{ p: 1 }}
            variant="contained"
            color="primary"
            startIcon={<ArrowForwardIos />}
          >
            {isLast ? "Finish tutorial" : "Continue"}
          </Button>
          {!isFirst && <Button
            fullWidth
            onClick={prev}
            sx={{ px: 1 }}
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<ArrowBackIos />}
          >
            Go back
          </Button>}
          {!isLast && <Link onClick={clear}>Close tutorial</Link>}
        </Stack>
      ),
      [clear, isLast, isFirst, next, prev]
    );

    // Always render the child the same, just pass setElementRef in
    const element = useMemo(
      () => children(hltId, setElementRef, highlighted),
      [children, hltId, highlighted]
    );

    const t = useTheme();

    useEffect(() => {
      if (!elementRef) return;
      elementRef.classList[highlighted ? "add" : "remove"](
        "highlighted-tutorial-element"
      );
    }, [highlighted, elementRef]);

    if (!highlighted) {
      return <>{element}</>;
    }

    const tooltipXY =
      position && rect
        ? { left: position.left, top: position.top, x: position.x, y: position.y }
        : undefined;

    // Initial values for animation:
    // - first step: start at its own position (no movement, just fade)
    // - subsequent steps: start from previous step's overlay position
    const initialBorder =
      last?.rect ?? rect ?? {
        top: 0,
        left: 0,
        width: 0,
        height: 0,
      };

    const initialTooltip =
      last?.tooltip ??
      (tooltipXY ?? {
        left: 0,
        top: 0,
        x: "0%",
        y: "0%",
      });

    return (
      <>
        <GlobalStyles
          styles={`.highlighted-tutorial-element{position: relative; z-index: ${t.zIndex.modal + 1
            }; pointer-events: ${clickable ? "auto" : "none"};}`}
        />

        {/* Element in its natural place */}
        {element}

        {/* Highlight frame + tooltip in a portal */}
        <Portal>
          {rect && position && (
            <>
              {/* Animated highlight frame around the element */}
              <MotionBox
                key={'hlt-highlight-frame'}
                initial={{
                  opacity: !!last ? 1 : 0,
                  left: initialBorder.left - HIGHLIGHT_MARGIN,
                  top: initialBorder.top - HIGHLIGHT_MARGIN,
                  width: initialBorder.width + HIGHLIGHT_MARGIN * 2,
                  height: initialBorder.height + HIGHLIGHT_MARGIN * 2,
                }}
                animate={{
                  opacity: 1,
                  left: rect.left - HIGHLIGHT_MARGIN,
                  top: rect.top - HIGHLIGHT_MARGIN,
                  width: rect.width + HIGHLIGHT_MARGIN * 2,
                  height: rect.height + HIGHLIGHT_MARGIN * 2,
                }}
                exit={{ opacity: 0 }}
                sx={(t) => ({
                  position: "fixed",
                  border: "3px solid " + t.palette.primary.main,
                  borderRadius: (t.shape.borderRadius as number * 2) + "px",
                  boxShadow: t.shadows[5],
                  zIndex: (theme) => theme.zIndex.modal + 3,
                  pointerEvents: "none",
                })}
              >
                <span style={{
                  position: "absolute",
                  background: t.palette.primary.main,
                  left: 0,
                  top: 0,
                  borderRadius: '100px',
                  transform: 'translate(-50%, -50%)',
                  width: 25,
                  height: 25,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Search fontSize="small" />
                </span>
              </MotionBox>

              {/* Animated tooltip */}
              <Box
                sx={{
                  position: "fixed",
                  inset: 0,
                  zIndex: (theme) => theme.zIndex.modal + 2,
                  width: "100%",
                  height: "100%",
                  overflow: "hidden",
                  pointerEvents: "none",
                }}
              >
                <MotionStack
                  key={'hlt-highlight-controls'}
                  layout={'size'}
                  initial={{
                    opacity: !!last ? 1 : 0,
                    left: initialTooltip.left,
                    top: initialTooltip.top,
                    x: initialTooltip.x,
                    y: initialTooltip.y,
                  }}
                  animate={{
                    opacity: 1,
                    left: tooltipXY!.left,
                    top: tooltipXY!.top,
                    x: position.x,
                    y: position.y,
                  }}
                  // exit={{ opacity: 0 }}
                  spacing={1}
                  alignItems={"center"}
                  justifyContent={"center"}
                  sx={{
                    p: 1,
                    position: "absolute",
                    minWidth: '30%',
                    maxWidth: "50%",
                    maxHeight: "50%",
                    ...(contentWidth ? { maxWidth: contentWidth, minWidth: contentWidth, width: contentWidth } : {}),
                    background: 'rgba(0,0,0,0.6)',
                    borderRadius: t.shape.borderRadius + "px",
                    pointerEvents: "auto", // tooltip clickable
                  }}
                  onPointerEnter={() => useHighlightTutorial.setState({ tooltipHovered: true })}
                  onPointerLeave={() => useHighlightTutorial.setState({ tooltipHovered: false })}
                >
                  {contentPosition === "below" && (
                    <ArrowUpward fontSize="large" />
                  )}

                  <Stack
                    direction={"row"}
                    alignItems={"center"}
                    spacing={1}
                  >
                    {contentPosition.endsWith("right") && (
                      <ArrowBack fontSize="large" sx={{
                        ...(contentPosition === 'below-right' ? {
                          alignSelf: 'flex-start',
                          rotate: '45deg',
                        } : contentPosition === 'above-right' ? {
                          alignSelf: 'flex-end',
                          rotate: '-45deg',
                        } : {})
                      }} />
                    )}

                    <Stack spacing={0.5} lineHeight={1.5}>
                      <Typography variant="h5">{title}</Typography>
                      {content}
                    </Stack>

                    {controls}

                    {contentPosition.endsWith("left") && (
                      <ArrowForward fontSize="large" sx={{
                        ... (contentPosition === 'below-left' ? {
                          alignSelf: 'flex-start',
                          rotate: '-45deg',
                        } : contentPosition === 'above-left' ? {
                          alignSelf: 'flex-end',
                          rotate: '45deg',
                        } : {})
                      }} />
                    )}
                  </Stack>

                  {contentPosition === "above" && (
                    <ArrowDownward fontSize="large" />
                  )}
                </MotionStack>
              </Box>
            </>
          )}
        </Portal>
      </>
    );
  };

const MotionBackDrop = motion.create(Backdrop);

export const AppHighlightTutorialWrapper = (props: PropsWithChildren) => {
  const anyOpen = !!useHighlightTutorial(s => (s.sequence?.length ?? 0) && (s.current !== null));
  const tooltipHovered = useHighlightTutorial(s => s.tooltipHovered);

  return (
    <>
      <AnimatePresence mode="sync">{props.children}</AnimatePresence>
      {/* Darkened background */}
      <MotionBackDrop
        open={anyOpen}
        animate={{
          backdropFilter: `blur(7px) brightness(.8)`,
        }}
        sx={{
          zIndex: (t) => t.zIndex.modal,
        }}
      />
    </>
  );
}

/* ---------------- STORES ---------------- */

export const useAvailableHighlightElements = create<{ [hltId: string]: true | null }>(
  () => ({})
);

export const useHighlightTutorial = create<{
  sequence: string[] | null;
  current: number | null;
  last: LastOverlayState;
  tooltipHovered: boolean;
  setLast: (last: LastOverlayState) => void;
  next: () => void;
  prev: () => void;
  start: (tutorial: HighlightTutorial) => void;
  clear: () => void;
}>((set, get) => {
  const clear = () => { set({ sequence: null, current: null, last: null, tooltipHovered: false }); };

  return {
    sequence: null,
    current: null,
    last: null,
    tooltipHovered: false,
    setLast: (last) => set({ last }),

    next: () => {
      const { sequence, current } = get();
      if (!sequence || current == null) return;

      const nextIndex = current + 1;
      const nextId = sequence[nextIndex];
      if (!nextId) {
        clear();
        return;
      }

      const nextElem = useAvailableHighlightElements.getState()[nextId];
      if (!nextElem) return;

      set({ current: nextIndex });
    },

    prev: () => {
      const { sequence, current } = get();
      if (!sequence || current == null) return;

      const prevIndex = current - 1;
      const prevId = sequence[prevIndex];

      if (!prevId) {
        clear();
        return;
      }

      const prevElem = useAvailableHighlightElements.getState()[prevId];
      if (!prevElem) return;

      set({ current: prevIndex });
    },

    start: (tutorial) => {
      clear();

      const steps = Object.values(tutorial);
      const sequence = steps.map((s) => s.hltId);
      if (!sequence.length) return;

      const firstId = sequence[0];
      const firstElem = useAvailableHighlightElements.getState()[firstId];
      if (!firstElem) return;

      set({ sequence, current: 0, last: null, tooltipHovered: false });
    },
    clear: () => clear(),
  };
});

export type HighlightTutorial = { [hltId: string]: Omit<Props, "children"> };

export const HighlightTutorialElementHelper = (props: { setRef: (ref: HTMLDivElement) => void, children: ReactNode }) => {
  return <Stack ref={props.setRef}>{props.children}</Stack>
}

useMainApp.subscribe(() => useHighlightTutorial.getState().clear());
useTutorial.subscribe(() => useHighlightTutorial.getState().clear());
