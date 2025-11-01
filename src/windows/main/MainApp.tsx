import { Close, Home, Info, Minimize, Settings } from "@mui/icons-material";
import { TabContext, TabList } from "@mui/lab";
import { Box, GlobalStyles, IconButton, Link, Portal, Stack, Tab, Typography } from "@mui/material";
import { AnimatePresence, motion } from "motion/react";
import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { BaseWindow } from "../../utils/window/AppWindow";
import { AppAbout } from "./about/AppAbout";
import { AppSettings } from "./settings/AppSettings";
import { SettingsHotkey } from "./settings/AppSettingsHotkey";
import { TutorialsOverlay, useTutorial } from "./welcome/AppTutorial";
import { AppWelcome } from "./welcome/AppWelcome";
import { MainAppTab, useMainApp } from "./use-main-app";

const MotionBox = motion(Box);

const AppTabPanel = (props: PropsWithChildren) => {
  return (
    <MotionBox
      initial={{ filter: "blur(20px)", opacity: 0 }}
      animate={{ filter: "blur(0px)", opacity: 1 }}
      exit={{ filter: "blur(20px)", opacity: 0 }}
      style={{ width: "100%", height: "100%", position: "absolute" }}
      p={2}
    >
      {props.children}
    </MotionBox>
  );
};

const HEADER_HEIGHT = 50;
function AlwaysOnTopHeader() {
  // const props = useAppProps();

  const desktop = useMainApp(s => s.mode === 'desktop');

  return (
    <>
      {/* keep page content from hiding under the fixed bar */}
      <GlobalStyles styles={{ ':root': { '--winbar-h': HEADER_HEIGHT + 'px' } }} />

      <Portal container={document.body}>
        <Stack
          id="header"
          direction="row"
          alignItems="center"
          spacing={1}
          sx={(t) => ({
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 'var(--winbar-h)',
            bgcolor: t.palette.background.paper,
            fontSize: '.95em',
            opacity: 0.8,
            px: 0.5,
            // higher than tooltip (1500) to be safe
            zIndex: t.zIndex.tooltip + 1, // => 1501 by default
            pointerEvents: 'auto',
          })}
        >
          <span style={{ marginLeft: 10 }}>
            <b>Fog Companion</b> <small>by Merlin</small>
          </span>
          <span style={{ flexGrow: 1 }} />
          <small style={{ marginRight: 10, opacity: 0.6 }}>
            Press <SettingsHotkey name="app_showhide" small noDelete /> to show/hide{!desktop ? '' : ' when game is in focus'}
          </small>
          <Stack direction={"row"}>
            <IconButton size="small" id="minimizeButton">
              <Minimize />
            </IconButton>
            <IconButton size="small" onClick={() => overwolf.windows.getMainWindow().close()}>
              <Close />
            </IconButton>
          </Stack>
        </Stack>
      </Portal>
    </>
  );
}

export const IngameApp = () => {
  const tab = useMainApp(s => s.tab);

  const tutorialOpen = useTutorial(s => s.tutorials.length > 0);
  const [adsReady, setAdsReady] = useState(false);
  const mountAds = !tutorialOpen && adsReady;

  useEffect(() => {
    (window as any).adsReady.then(res => setAdsReady(res));
  }, []);

  return (
    <BaseWindow resizable>
      <Stack position={'fixed'} top={0} left={0} m={0} p={0} width={'100vw'} height={'100vh'} overflow={'hidden'}>
        <TabContext value={tab}>
          <Box width={'100%'} height={HEADER_HEIGHT}></Box>
          <AlwaysOnTopHeader />

          <Stack direction={'row'} pr={2} alignItems={"center"} width={'100%'} height={'100%'}>
            <Stack m={0} p={0} overflow={"hidden"} width={"100vw"} height={'100%'} position={'relative'}>
              <TutorialsOverlay />

              <TabList onChange={(_, v) => useMainApp.setState({ tab: v })} variant="fullWidth" sx={{ pr: 2 }}>
                <Tab value={0} label={<Stack direction={'row'} spacing={1} alignItems={'center'}><Home /><span>Home</span></Stack>} />
                <Tab value={1} label={<Stack direction={'row'} spacing={1} alignItems={'center'}><Settings /><span>Settings</span></Stack>} />
                <Tab value={2} label={<Stack direction={'row'} spacing={1} alignItems={'center'}><Info /><span>About</span></Stack>} />
              </TabList>

              <Box width={"100%"} height={"100%"} overflow={"auto"} position={"relative"}>
                <AnimatePresence mode="sync" initial={false}>
                  {tab === MainAppTab.WELCOME && (
                    <AppTabPanel key="tab-0">
                      <AppWelcome />
                    </AppTabPanel>
                  )}
                  {tab === MainAppTab.SETTINGS && (
                    <AppTabPanel key="tab-1">
                      <AppSettings />
                    </AppTabPanel>
                  )}
                  {tab === MainAppTab.ABOUT && (
                    <AppTabPanel key="tab-2">
                      <AppAbout />
                    </AppTabPanel>
                  )}
                </AnimatePresence>
              </Box>
            </Stack>
            {mountAds && <AdContainer key={'ad-container'} />}
          </Stack>
        </TabContext>
      </Stack>
    </BaseWindow>
  );
};

const AdContainer = () => {
  console.log('render-ad');
  const adRef = useRef<any>(null);
  const [showTips, setShowTips] = useState(false);

  const onLoad = () => {
    console.log('ad-onload');

    const OwAd = (window as any).OwAd;
    if (!OwAd) return;

    const el = document.getElementById('ad-160x600');
    adRef.current = new OwAd(el, { size: { width: 160, height: 600 } });

    adRef.current.addEventListener('display_ad_loaded', () => { console.log('display-ad-loaded'); setShowTips(false); });
    adRef.current.addEventListener('error', e => { console.log('ad error', e); setShowTips(true); });

    console.log('ad-added');
  }

  useEffect(() => {
    console.log('call-ad-onload');
    onLoad();
    return () => {
      console.log('call-ad-shutdown');
      adRef.current?.shutdown();
    }
  }, []);

  const [tipNum, setTipNum] = useState(Math.floor(Math.random() * Tips.length));
  const tip = Tips[tipNum];

  return (
    <div style={{ position: 'relative', padding: 0, margin: 0, width: 160, height: 600 }}>
      {showTips && (
        <Stack zIndex={9999} position={'absolute'} width={'100%'} height={'100%'} alignItems={'center'} justifyContent={'center'} textAlign={'center'} spacing={1}>
          <div style={{ width: '100%', aspectRatio: '1/1', backgroundImage: `url(/img/Logo.png)`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
          <Typography variant="body2" style={{ opacity: .8 }}>Tips</Typography>
          <Typography variant="body2" style={{ opacity: .6 }}><small>{tip}</small></Typography>
          <small><Link onClick={() => setTipNum((tipNum + 1) % Tips.length)} style={{ opacity: .9 }}>Next tip</Link></small>
        </Stack>
      )}
      <div id={"ad-160x600"} style={{ width: 160, height: 600 }} />
    </div>
  );
};

const Tips = [
  "Turn smart map detection on for escape-streaks.",
  "Automatic killer detection can enable Start on M2 (Rush/Blink) for Blight and Nurse.",
  "Click 'Learn More' on any feature to restart its tutorial.",
  "You can change size/opacity of callouts in the settings.",
  "You can restart the tutorial under 'About'.",
  "Move the 1v1 overlay wherever you like on the Overwolf exclusive focus.",
  "You can replace the callout graphics with your own ones.",
  "You can move the main window onto a second screen."
];