import { Group, Help, Map, Settings, Timer, TipsAndUpdates } from "@mui/icons-material";
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, FormControlLabel, Grid, Paper, Stack, Typography } from "@mui/material";
import { PropsWithChildren, ReactElement, memo, useCallback, useState } from "react";

import { INGAME_SETTINGS } from "../in_game-settings";
import { AppSettingsSection, useAppSettings } from "../settings/use-app-settings";
import { MainAppTab, useMainApp } from "../use-main-app";
import { useTutorial } from "./AppTutorial";
import { MODE_1V1_TUTORIAL } from "./tutorials/Mode1v1Tutorial";
import { Enable1v1ModeFeature, EnableCalloutFeature, EnableKillerDetectionFeature, EnableMapDetectionFeature, EnableSmartFeatures } from "../settings/EnableDisableFeatures";
import { CALLOUT_TUTORIAL } from "./tutorials/CalloutTutorial";
import { BACKGROUND_SETTINGS } from "../../background/background-settings";
import { SettingsHotkey } from "../settings/AppSettingsHotkey";
import { AppDetectionDisplay } from "./AppDetectionDisplay";

/** ---------------- Primitives ---------------- */

const OnboardingCard = memo((
  props: PropsWithChildren<{
    title: string;
    img: string;
    icon: ReactElement;
    onSettings?: () => void;
    onLearnMore?: () => void;
    enableDisable?: ReactElement;
    enabled?: boolean;
  }>
) => {
  return (
    <Grid size={{ xs: 6 }} sx={{ flexGrow: 1, position: 'relative', opacity: props.enabled ? 1 : 0.5 }}>
      <Card
        sx={{ width: '100%', height: '100%' }}
      >
        <CardContent sx={t => ({ pb: `${t.spacing(2)} !important`, overflow: 'hidden', height: '100%' })}>
          <Stack height="100%" width="100%" spacing={1}>
            <Stack direction="row" spacing={1} width="100%" alignItems={'center'}>
              {props.icon}
              <Typography variant="h6">{props.title}</Typography>
              <span style={{ flexGrow: 1 }} />
              <span>{props.enableDisable}</span>
            </Stack>
            <Stack spacing={1} width="100%" flexGrow={1} overflow={'auto'}>
              {props.children}
            </Stack>
            {!!props.onLearnMore && !!props.onSettings && (
              <Stack direction={'row'} spacing={1}>
                {props.onLearnMore &&
                  <Button size="small" variant="outlined" color="info" startIcon={<Help />} onClick={props.onLearnMore}>
                    Learn more
                  </Button>}
                {props.onSettings &&
                  <Button size="small" variant="outlined" startIcon={<Settings />} onClick={props.onSettings}>
                    Settings
                  </Button>}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  );
});
OnboardingCard.displayName = 'OnboardingCard';

/** ---------------- Blocks ---------------- */

const TimerCard = memo(() => {
  const openSettings = useCallback(() => {
    useMainApp.setState({ tab: MainAppTab.SETTINGS });
    useAppSettings.setState({ expand: AppSettingsSection.MODE_1v1 });
  }, []);

  const openTutorial = useCallback(() => {
    useTutorial.getState().setTutorials([MODE_1V1_TUTORIAL]);
  }, []);

  return (
    <OnboardingCard
      enabled={BACKGROUND_SETTINGS.hook(s => s.mode === "1v1")}
      icon={<Timer />}
      title="Mode: 1v1"
      onSettings={openSettings}
      onLearnMore={openTutorial}
      enableDisable={<Enable1v1ModeFeature small />}
      img=""
    >
      <Typography variant="body2">
        Use the <b>1v1 timer</b> to track your chase time. No external app or smartphone needed. <b>Crouch</b> or <b>Swing</b> to start the timer.
      </Typography>
      <Typography variant="body2">
        Move the overlay around on the overwolf exclusive focus (usually <Chip size="small" label="Ctrl+Tab" />).
      </Typography>
    </OnboardingCard>
  );
});
TimerCard.displayName = 'TimerCard';

const ScrimsCard = memo(() => {
  return (
    <OnboardingCard
      enabled={false}
      icon={<Group />}
      title="Mode: Scrims/Tournaments"
      img=""
    >
      <Alert variant="outlined" severity="warning">This mode is not yet available.</Alert>
    </OnboardingCard>
  );
});
ScrimsCard.displayName = 'ScrimsCard';

const CalloutCard = memo(() => {
  const openSettings = useCallback(() => {
    useMainApp.setState({ tab: MainAppTab.SETTINGS });
    useAppSettings.setState({ expand: AppSettingsSection.CALLOUT });
  }, []);

  const openTutorial = useCallback(() => {
    useTutorial.getState().setTutorials([CALLOUT_TUTORIAL]);
  }, []);

  return (
    <OnboardingCard
      icon={<Map />}
      title="Callout Overlay"
      onSettings={openSettings}
      onLearnMore={openTutorial}
      enableDisable={<EnableCalloutFeature small />}
      enabled={BACKGROUND_SETTINGS.hook(s => s.calloutOverlay)}
      img=""
    >
      <Typography variant="body2">
        <Stack spacing={1}>
          <span>
            Show <b>callout-images</b> as overlay and let the <b>auto-detection</b> work for you!
            <br />You can also override the default graphics with your own ones.
          </span>
          <span>
            Open the Map Browser with <SettingsHotkey name="map_browser" small />
            <br /><small>(See/change how to control it in the settings or Tutorial)</small>
          </span>
        </Stack>
      </Typography>
    </OnboardingCard>
  );
});
CalloutCard.displayName = 'CalloutCard';

const SmartFeaturesCard = memo(() => {
  return (
    <OnboardingCard
      icon={<TipsAndUpdates />}
      title="Smart Features"
      enableDisable={<EnableSmartFeatures />}
      enabled={BACKGROUND_SETTINGS.hook(s => s.enableSmartFeatures)}
      img=""
    >
      <Stack spacing={1} height={'100%'}>
        <small style={{ opacity: .6 }}>
          Allows the app to detect the game state using screenshots.
          Disable this if you notice problems with your performance.
        </small>
        <Stack direction={'row'} alignItems={'center'}>
          <Stack flexGrow={1}>
            <span>Auto-Detect current map</span>
            <small style={{ opacity: .6 }}>This allows to auto-select callout graphics.</small>
          </Stack>
          <EnableMapDetectionFeature />
        </Stack>
        <Stack direction={'row'} alignItems={'center'}>
          <Stack flexGrow={1}>
            <span>Auto-Detect M2 killers</span>
            <small style={{ opacity: .6 }}>Start the 1v1 timer on M2 for Nurse and Blight.</small>
          </Stack>
          <EnableKillerDetectionFeature />
        </Stack>
        <span style={{ flexGrow: 1 }} />
        <AppDetectionDisplay />
      </Stack>
    </OnboardingCard>
  )
})

/** ---------------- Root ---------------- */

export const AppWelcome = () => {
  // Localize subscription so only this component re-renders when this value changes
  const openOnStartup = INGAME_SETTINGS.hook(s => s.openOnStartup);
  const showInGame = INGAME_SETTINGS.hook(s => s.showInGame);

  const handleOpenOnStartup = useCallback((_: unknown, v: boolean) => {
    INGAME_SETTINGS.update({ openOnStartup: v });
  }, []);

  const handleShowInGame = useCallback((_: unknown, v: boolean) => {
    INGAME_SETTINGS.update({ showInGame: v });
  }, []);

  const close = () => overwolf.windows.getMainWindow().close();

  return (
    <Stack width="100%" height="100%" alignItems="center" justifyContent="center" spacing={3}>
      <Stack>
        <Typography variant="h5">Welcome to Fog Companion for competitive Dead by Daylight</Typography>
        <Typography variant="caption" style={{ opacity: .8 }}>Learn what this app can do for you:</Typography>
      </Stack>

      <Grid container flexGrow={1} spacing={1} width="100%">
        <TimerCard />
        <ScrimsCard />
        <CalloutCard />
        <SmartFeaturesCard />
      </Grid>

      <Stack direction={'row'} spacing={4} style={{ opacity: .75 }} alignItems={"center"}>
        <FormControlLabel
          label={<Stack><span>Use this window in-game.</span><small>Disable for second-screen use.</small></Stack>}
          control={<Checkbox checked={showInGame} onChange={handleShowInGame} size="small" />}
        />
        <FormControlLabel
          label={<Stack><span>Open this window with DBD</span><small>Disable to only open manually.</small></Stack>}
          control={<Checkbox checked={openOnStartup} onChange={handleOpenOnStartup} size="small" />}
        />
      </Stack>
    </Stack >
  );
};
