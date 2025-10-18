import { Close, Minimize } from "@mui/icons-material";
import { TabContext, TabList, useTabContext } from "@mui/lab";
import { Box, IconButton, Stack, Tab } from "@mui/material";
import { PropsWithChildren, useState } from "react";
import { useHotkeys } from "../../utils/hooks/hotkey-hook";
import { BaseWindow } from "../../utils/window/AppWindow";
import { AppSettings } from "./settings/AppSettings";
import { AppWelcome } from "./welcome/AppWelcome";
import { AnimatePresence, motion } from "motion/react";
import { IngameAppTab, useIngameApp } from "./use-ingame-app";
import { TutorialsOverlay } from "./welcome/AppTutorial";
import { AppAbout } from "./about/AppAbout";

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

export const IngameApp = () => {
  const app_showhide = useHotkeys((s) => s.app_showhide);
  const tab = useIngameApp(s => s.tab);

  return (
    <BaseWindow resizable>
      <TutorialsOverlay />
      <TabContext value={tab}>
        <Stack m={0} p={0} position={'fixed'} top={0} left={0} overflow={"hidden"} width={"100vw"} height={"100vh"}>
          <Stack
            id="header"
            position={'relative'}
            zIndex={1000000000}
            direction={"row"}
            alignItems={"center"}
            spacing={1}
            p={0.5}
            style={{ opacity: 0.8 }}
            width={"100%"}
            sx={(t) => ({ bgcolor: t.palette.background.paper })}
            fontSize={".95em"}
          >
            <span style={{ marginLeft: 10 }}>
              <b>DBD COMPanion</b> <small>by Merlin</small>
            </span>
            <span style={{ flexGrow: 1 }} />
            <small style={{ marginRight: 10, opacity: 0.6 }}>
              Press <b>{app_showhide}</b> to show/hide
            </small>
            <Stack direction={"row"}>
              <IconButton size="small" id="minimizeButton">
                <Minimize />
              </IconButton>
              <IconButton size="small" id="closeButton">
                <Close />
              </IconButton>
            </Stack>
          </Stack>

          <TabList onChange={(_, v) => useIngameApp.setState({ tab: v })} variant="fullWidth">
            <Tab value={0} label="Welcome" />
            <Tab value={1} label="Settings" />
            <Tab value={2} label="About" />
          </TabList>

          <Box width={"100%"} height={"100%"} overflow={"auto"} position={"relative"}>
            <AnimatePresence mode="sync" initial={false}>
              {tab === IngameAppTab.WELCOME && (
                <AppTabPanel key="tab-0">
                  <AppWelcome />
                </AppTabPanel>
              )}
              {tab === IngameAppTab.SETTINGS && (
                <AppTabPanel key="tab-1">
                  <AppSettings />
                </AppTabPanel>
              )}
              {tab === IngameAppTab.ABOUT && (
                <AppTabPanel key="tab-2">
                  <AppAbout />
                </AppTabPanel>
              )}
            </AnimatePresence>
          </Box>
        </Stack>
      </TabContext>
    </BaseWindow>
  );
};
