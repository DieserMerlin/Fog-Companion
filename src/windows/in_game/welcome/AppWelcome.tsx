import { Group, Help, Map, Settings, Timer } from "@mui/icons-material";
import { Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, Grid, Stack, Typography } from "@mui/material";
import { PropsWithChildren, ReactElement, memo, useCallback, useState } from "react";

import { INGAME_SETTINGS } from "../in_game-settings";
import { AppSettingsSection, useAppSettings } from "../settings/use-app-settings";
import { IngameAppTab, useIngameApp } from "../use-ingame-app";
import { useTutorial } from "./AppTutorial";
import { MODE_1V1_TUTORIAL } from "./tutorials/Mode1v1Tutorial";
import { Enable1v1ModeFeature, EnableCalloutFeature } from "../settings/EnableDisableFeatures";
import { CALLOUT_TUTORIAL } from "./tutorials/CalloutTutorial";

/** ---------------- Primitives ---------------- */

const OnboardingCard = memo((
  props: PropsWithChildren<{
    title: string;
    img: string;
    icon: ReactElement;
    onSettings?: () => void;
    onLearnMore?: () => void;
    enableDisable?: ReactElement;
  }>
) => {
  return (
    <Grid size={{ xs: 6 }} sx={{ flexGrow: 1, position: 'relative' }}>
      <Card
        style={{ width: '100%', height: '100%' }}
      >
        <CardContent style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
          <Stack height="100%" width="100%" spacing={1}>
            <Stack spacing={1} width="100%" flexGrow={1} justifyContent="center">
              <Stack direction="row" alignItems="center" spacing={1}>
                {props.icon}
                <Typography variant="h6">{props.title}</Typography>
              </Stack>
              {props.children}
            </Stack>
            <Stack direction="row" spacing={1} width="100%">
              {props.onLearnMore &&
                <Button variant="outlined" color="info" startIcon={<Help />} onClick={props.onLearnMore}>
                  Learn how to use
                </Button>}
              {props.onSettings &&
                <Button variant="outlined" startIcon={<Settings />} onClick={props.onSettings}>
                  Open Settings
                </Button>}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {!!props.enableDisable && (
        <Box sx={{ position: 'absolute', top: 10, right: 10 }}>
          {props.enableDisable}
        </Box>
      )}
    </Grid>
  );
});
OnboardingCard.displayName = 'OnboardingCard';

/** ---------------- Blocks ---------------- */

const TimerCard = memo(() => {
  const openSettings = useCallback(() => {
    useIngameApp.setState({ tab: IngameAppTab.SETTINGS });
    useAppSettings.setState({ expand: AppSettingsSection.MODE_1v1 });
  }, []);

  const openTutorial = useCallback(() => {
    useTutorial.getState().setTutorials([MODE_1V1_TUTORIAL]);
  }, []);

  return (
    <OnboardingCard
      icon={<Timer />}
      title="1v1-Timer"
      onSettings={openSettings}
      onLearnMore={openTutorial}
      enableDisable={<Enable1v1ModeFeature small />}
      img=""
    >
      <Typography variant="body2">
        Use the <b>1v1 timer</b> to track your chase time. No external app or smartphone needed!. <b>Crouch</b> or <b>Swing</b> to start the timer!
      </Typography>
    </OnboardingCard>
  );
});
TimerCard.displayName = 'TimerCard';

const ScrimsCard = memo(() => {
  return (
    <OnboardingCard
      icon={<Group />}
      title="Scrims/Tournaments"
      img=""
    >
      <Alert variant="outlined" severity="warning">This mode is not yet available.</Alert>
    </OnboardingCard>
  );
});
ScrimsCard.displayName = 'ScrimsCard';

const CalloutCard = memo(() => {
  const openSettings = useCallback(() => {
    useIngameApp.setState({ tab: IngameAppTab.SETTINGS });
    useAppSettings.setState({ expand: AppSettingsSection.CALLOUT });
  }, []);

  const openTutorial = useCallback(() => {
    useTutorial.getState().setTutorials([CALLOUT_TUTORIAL]);
  }, []);

  return (
    <OnboardingCard
      icon={<Map />}
      title="Callout-Overlay"
      onSettings={openSettings}
      onLearnMore={openTutorial}
      enableDisable={<EnableCalloutFeature small />}
      img=""
    >
      <Typography variant="body2">
        Show <b>callout-images</b> as overlay and let the <b>auto-detection</b> work for you!
        <br />You can also override the default graphics with your own ones.
      </Typography>
    </OnboardingCard>
  );
});
CalloutCard.displayName = 'CalloutCard';

/** ---------------- Root ---------------- */

export const AppWelcome = () => {
  // Localize subscription so only this component re-renders when this value changes
  const openOnStartup = INGAME_SETTINGS.hook(s => s.openOnStartup);

  const handleOpenOnStartup = useCallback((_: unknown, v: boolean) => {
    INGAME_SETTINGS.update({ openOnStartup: v });
  }, []);

  return (
    <Stack width="100%" height="100%" alignItems="center" justifyContent="center" spacing={2}>
      <Stack>
        <Typography variant="h5">Welcome to the companion app for competitive DBD!</Typography>
        <Typography variant="caption" style={{ opacity: .8 }}>Learn what this app can do for you:</Typography>
      </Stack>

      <Grid container flexGrow={1} spacing={1} width="90%">
        <TimerCard />
        <ScrimsCard />
        <CalloutCard />
      </Grid>

      <FormControlLabel
        style={{ opacity: .75 }}
        label="Open this window with DBD"
        control={<Checkbox checked={openOnStartup} onChange={handleOpenOnStartup} />}
      />
    </Stack>
  );
};
