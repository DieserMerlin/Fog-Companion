import { ArrowBackIos, ArrowForwardIos } from '@mui/icons-material';
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from '@mui/material/Dialog';
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { AnimatePresence, motion } from "motion/react";
import React, { PropsWithChildren, ReactElement, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { WELCOME_TUTORIALS } from "./tutorials/WelcomeTutorial";

/** ---------------- Types ---------------- */

type Content = string | number | ReactElement | ReactElement[];

export type TutorialStep = {
  title: Content;
  content?: Content;
  media?: { type: 'image' | 'video', src: string | string[], position: string },
  notice?: Content;
  buttonTexts?: { next?: Content, prev?: Content }
};

export type Tutorial = TutorialStep & {
  steps: TutorialStep[];
};

/** ---------------- Store ---------------- */

export const useTutorial = create<{
  tutorials: Tutorial[],
  currentIndex: number,
  clear: () => void,
  setTutorials: (tutorials: Tutorial[]) => void,
}>(set => ({
  tutorials: [],
  currentIndex: 0,
  clear: () => set({ tutorials: [], currentIndex: 0 }),
  setTutorials: (tutorials) => set({ tutorials }),
}));

// one-time bootstrap
if (!localStorage.getItem('tutorial')) {
  localStorage.setItem('tutorial', '1');
  useTutorial.getState().setTutorials(WELCOME_TUTORIALS);
}

/** ---------------- Primitives ---------------- */

type SlideNavigationProps = {
  onPrev?: () => void,
  onNext: () => void,
  nextText?: Content,
  prevText?: Content
};

type SlideTutorialPositionProps = {
  current: {
    section: Content;
    slide?: Content;
  },
  next?: Content;
};

type RenderSlideProps = {
  slide: TutorialStep,
  navigation: SlideNavigationProps,
  position: SlideTutorialPositionProps,
};

const TutorialPositionBar = (props: SlideTutorialPositionProps) => {
  const slide = props.current.slide || props.current.section;
  const section = (slide === props.current.section) ? null : props.current.section;

  return (
    <Stack direction={'row'} position={'absolute'} bottom={10} left={10} justifyContent={'center'} alignItems={'center'} spacing={1}>
      {/* {!!section && <>
        <small style={{ opacity: .8 }} children={section} />
        <span>/</span>
      </>}
      {!!slide && <small children={slide} />}
      <span style={{ flexGrow: 1 }} /> */}
      {!!props.next && <small style={{ opacity: .5 }}> Next: <span children={props.next} /></small>}
    </Stack>
  );
}

const ControlsBar = memo((props: SlideNavigationProps) => {
  return (
    <Stack spacing={1} style={{ position: 'fixed', bottom: 20, right: 20 }} alignItems="right">
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="flex-end">
        <CloseTutorialConfirmation>Close tutorial</CloseTutorialConfirmation>
        {!!props.onPrev && (
          <Button startIcon={<ArrowBackIos />} variant="outlined" onClick={props.onPrev}>
            {props.prevText || 'Back'}
          </Button>
        )}
        <Button endIcon={<ArrowForwardIos />} style={{ width: 200 }} variant="contained" onClick={props.onNext}>
          {props.nextText || 'Next'}
        </Button>
      </Stack>
    </Stack>
  );
});
ControlsBar.displayName = 'ControlsBar';

const MediaPane = memo((props: { media?: TutorialStep['media'] }) => {
  const [mediaSrc, setMediaSrc] = useState<string | undefined>(undefined);

  // Keep original behavior: start once when mounted (no dependency on props.media)
  useEffect(() => {
    if (!props.media) return;
    if (typeof props.media.src === 'string') {
      setMediaSrc(props.media.src);
      return;
    }
    if (!Array.isArray(props.media.src) || !props.media.src.length) return;
    let i = 0;
    setMediaSrc(props.media.src[i++]);
    const interval = setInterval(() => {
      setMediaSrc(props.media!.src[i++ % props.media!.src.length]);
    }, 1000);
    return () => clearInterval(interval);
  }, []); // intentionally empty to keep exact original timing semantics

  if (!props.media) return null;

  return (
    <Stack width="40%" height="100%" sx={t => ({ bgcolor: t.palette.background.paper })}>
      <Box sx={t => ({
        width: '100%', height: '5%',
        backgroundImage: `linear-gradient(0deg,rgba(2, 0, 36, 0) 0%, ${t.palette.background.paper} 100%)`,
        transform: 'translateY(100%)', position: 'relative', zIndex: 1000002
      })} />
      {props.media.type === 'image'
        ? <div style={{
          width: '100%', height: '90%',
          backgroundImage: `url(${mediaSrc})`,
          backgroundSize: 'cover',
          backgroundPosition: props.media.position
        }} />
        : <div style={{ width: '100%', height: '90%' }}>
          <TutorialVideo src={mediaSrc} position={props.media.position} />
        </div>}
      <Box sx={t => ({
        width: '100%', height: '5%',
        backgroundImage: `linear-gradient(180deg,rgba(2, 0, 36, 0) 0%, ${t.palette.background.paper} 100%)`,
        transform: 'translateY(-100%)'
      })} />
    </Stack>
  );
});
MediaPane.displayName = 'MediaPane';

const RenderSlide = memo((props: RenderSlideProps) => {
  return (
    <Stack position="absolute" width="100%" height="100%" direction="row">
      <TutorialPositionBar {...props.position} />

      <Paper style={{ flexGrow: 1 }}>
        <Stack p={4} justifyContent="center" flexGrow={1} height="100%" spacing={4} position="relative">
          <Typography variant="h4">{props.slide.title}</Typography>

          {!!props.slide.content && (
            <Stack spacing={2}>{props.slide.content}</Stack>
          )}

          {!!props.slide.notice && <small style={{ opacity: .7 }}>{props.slide.notice}</small>}
        </Stack>
      </Paper>

      <MediaPane media={props.slide.media} />

      <ControlsBar
        {...props.navigation}
        onNext={props.navigation.onNext || (() => useTutorial.getState().clear())}
      />
    </Stack>
  );
});
RenderSlide.displayName = 'RenderSlide';

/** ---------------- Animation ---------------- */

const TOP = 1000002;
const BOTTOM = 1000001;

const slideVariants = {
  initial: (dir: 1 | -1) => (
    dir === 1
      ? { width: '50vw', x: '100vw', filter: 'brightness(1) blur(0)', zIndex: TOP }
      : { width: '100vw', x: '-50vw', filter: 'brightness(0.7) blur(10px)', zIndex: BOTTOM }
  ),
  animate: (dir: 1 | -1) => ({
    width: '100vw',
    x: 0,
    filter: 'brightness(1) blur(0)',
    zIndex: dir === 1 ? TOP : BOTTOM,
    transitionEnd: dir === -1 ? { zIndex: TOP } : undefined,
  }),
  exit: (dir: 1 | -1) => (
    dir === 1
      ? { width: '100vw', x: '-50vw', filter: 'brightness(0.7) blur(10px)', zIndex: BOTTOM }
      : { width: '50vw', x: '100vw', filter: 'brightness(1) blur(0)', zIndex: TOP }
  ),
};

const SlideAnimationWrapper = memo((
  props: PropsWithChildren<{ id: number; direction: 1 | -1 }>
) => {
  return (
    <motion.div
      key={props.id}
      style={{
        position: 'absolute', width: '100%', height: '100%',
        left: 0, top: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', overflow: 'hidden'
      }}
      variants={slideVariants}
      custom={props.direction}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.8, ease: [.29, .29, .17, 1] }}
    >
      {props.children}
    </motion.div>
  );
});
SlideAnimationWrapper.displayName = 'SlideAnimationWrapper';

/** ---------------- Root ---------------- */

export const TutorialsOverlay = () => {
  const { currentIndex, tutorials } = useTutorial();
  const isOpen = tutorials.length > 0;

  return (
    <AnimatePresence mode="wait" initial={false} onExitComplete={() => console.log('overlay exited')}>
      {isOpen && (
        <motion.div
          key="tutorials"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1000000, willChange: 'transform' }}
          initial={{ x: '100%' }}   // use %; vw can be flaky in motion/react
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}      // slide back out the same way it came in
          transition={{ duration: 0.5, ease: [0.29, 0.29, 0.17, 1] }}
        >
          <RenderTutorialsInner tutorials={tutorials} currentIndex={currentIndex} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const RenderTutorialsInner = ({ currentIndex, tutorials }: { currentIndex: number, tutorials: Tutorial[] }) => {
  // compute direction (stable with ref)
  const prev = useRef(currentIndex);
  const direction: 1 | -1 = currentIndex > prev.current ? 1 : -1;
  useEffect(() => { prev.current = currentIndex; }, [currentIndex]);

  // Precompute slides once per tutorials change
  const allSlides = useMemo<RenderSlideProps[]>(() => {
    return tutorials.flatMap((t, tutorialIdx) => {
      const tutorialSlides: TutorialStep[] = [t, ...t.steps];
      const isFirstTutorial = tutorialIdx === 0;
      const isLastTutorial = tutorialIdx === (tutorials.length - 1);

      return tutorialSlides.map((s, i) => {
        const isFirstSlide = i === 0;
        const isLastSlide = i === (tutorialSlides.length - 1);

        const onPrev = () => useTutorial.setState(st => ({ currentIndex: st.currentIndex - 1 }));
        const onNext = () => useTutorial.setState(st => ({ currentIndex: st.currentIndex + 1 }));

        return {
          position: {
            current: { section: t.title, slide: s.title !== t.title ? s.title : undefined },
            next: tutorialSlides[i + 1]?.title
          },
          navigation: {
            onPrev: (isFirstTutorial && isFirstSlide) ? undefined : onPrev,
            onNext: (isLastTutorial && isLastSlide) ? undefined : onNext,
            nextText: s.buttonTexts?.next
              || ((!isLastTutorial && isLastSlide) ? 'Next tutorial'
                : (isLastTutorial && isLastSlide) ? 'Finish tutorial'
                  : undefined),
            prevText: s.buttonTexts?.prev || undefined,
          },
          slide: s,
        } satisfies RenderSlideProps;
      });
    });
  }, [tutorials]);

  const current = allSlides[currentIndex];

  return current ? (
    // keep your inner presence for slide-to-slide animation
    <AnimatePresence mode="sync" initial={false} custom={direction}>
      <SlideAnimationWrapper id={currentIndex} key={currentIndex} direction={direction}>
        <RenderSlide {...current} />
      </SlideAnimationWrapper>
    </AnimatePresence>
  ) : null;
};

/** ---------------- Media: Video ---------------- */

type TutorialVideoProps = {
  src: string | undefined;
  position?: string;
  poster?: string;
  children?: React.ReactNode;
  className?: string;
};

export const TutorialVideo: React.FC<TutorialVideoProps> = memo(({
  src,
  position = "center",
  poster,
  children,
  className,
}) => {
  return (
    <Box
      className={className}
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        bgcolor: "common.black",
      }}
    >
      <Box
        component="video"
        src={src}
        autoPlay
        muted
        loop
        playsInline
        poster={poster}
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: position,
          pointerEvents: "none",
        }}
      />
      <Box sx={{ position: "relative", zIndex: 1 }}>{children}</Box>
    </Box>
  );
});
TutorialVideo.displayName = 'TutorialVideo';

export const CloseTutorialConfirmation = (props: PropsWithChildren<{ onClose?: () => void }>) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Link onClick={() => setOpen(true)}>{props.children}</Link>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <Stack m={2} spacing={1}>
          <Stack>
            <Typography variant="h6">Close the tutorial?</Typography>
            <span>This will close the tutorial. You can always restart it on the <b>About</b> tab.</span>
          </Stack>
          <Stack direction={'row'} spacing={1}>
            <Button variant="outlined" color="info" onClick={() => setOpen(false)}>Not yet</Button>
            <Button variant="contained" color="error" onClick={() => { setOpen(false); useTutorial.getState().clear(); props.onClose && setTimeout(props.onClose, 0) }}>Close Tutorial</Button>
          </Stack>
        </Stack>
      </Dialog>
    </>
  )
}