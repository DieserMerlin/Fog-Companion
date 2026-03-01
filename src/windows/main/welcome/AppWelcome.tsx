import { Group, Help, Map, Settings, Timer, TipsAndUpdates } from "@mui/icons-material";
import { Alert, Button, Card, CardContent, Checkbox, Chip, FormControlLabel, Grid, Link, Stack, Typography } from "@mui/material";
import { memo, PropsWithChildren, ReactElement, ReactNode, useCallback } from "react";

import { BACKGROUND_SETTINGS } from "../../background/background-settings";
import { INGAME_SETTINGS } from "../in_game-settings";
import { SettingsHotkey } from "../settings/AppSettingsHotkey";
import { Enable1v1ModeFeature, EnableCalloutFeature, EnableKillerDetectionFeature, EnableMapDetectionFeature, EnableSmartFeatures } from "../settings/EnableDisableFeatures";
import { AppSettingsSection, useAppSettings } from "../settings/use-app-settings";
import { MainAppTab, useMainApp } from "../use-main-app";
import { AppDetectionDisplay } from "./AppDetectionDisplay";
import { AppHighlightTutorialWrapper, HighlightTutorialElementHelper, HLTElement, useHighlightTutorial } from "./tutorials/AppHighlightTutorial";
import { useTutorial } from "./tutorials/AppTutorial";
import { CALLOUT_TUTORIAL } from "./tutorials/fullscreen/CalloutTutorial";
import { MODE_1V1_TUTORIAL } from "./tutorials/fullscreen/Mode1v1Tutorial";
import { HomeViewTutorial } from "./tutorials/highlight/HomeViewTutorial";

type CardProps = { setRef?: (ref: HTMLDivElement) => void, buttonTutorial?: true };

/** ---------------- Primitives ---------------- */

const OnboardingCard = memo((
  props: PropsWithChildren<{
    title: string | ReactNode;
    img: string;
    icon: ReactElement;
    onSettings?: () => void;
    onLearnMore?: () => void;
    enableDisable?: ReactElement;
    enabled?: boolean;
  } & CardProps>
) => {
  const tutorialOpen = useHighlightTutorial(s => !!s.sequence && typeof s.current === 'number');

  return (
    <Grid size={{ xs: 6 }} sx={{ flexGrow: 1, position: 'relative', opacity: props.enabled || tutorialOpen ? 1 : 0.5 }} ref={props.setRef}>
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
            <Stack spacing={1} width="100%" height={'100%'} justifyContent={'center'} flexGrow={1} overflow={'auto'}>
              {props.children}
            </Stack>
            {!!props.onLearnMore && !!props.onSettings && (
              <Stack direction={'row'} spacing={1}>
                {props.onLearnMore &&
                  <HLTElement {...HomeViewTutorial.LearnMoreBtn} ignore={!props.buttonTutorial}>
                    {(key, setRef, highlighted) => (<Button ref={setRef} size="small" variant="outlined" color="info" startIcon={<Help />} onClick={props.onLearnMore}>
                      Learn more
                    </Button>)}
                  </HLTElement>}
                {props.onSettings &&
                  <HLTElement {...HomeViewTutorial.SettingsBtn} ignore={!props.buttonTutorial}>
                    {(key, setRef, highlighted) => (<Button ref={setRef} size="small" variant="outlined" startIcon={<Settings />} onClick={props.onSettings}>
                      Settings
                    </Button>)}
                  </HLTElement>}
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

const TimerCard = memo((props: CardProps) => {
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
      enableDisable={<HLTElement key={'timer-card-enable-disable'} {...HomeViewTutorial.ToggleModeSwitch}>{(key, setRef, highlighted) => <HighlightTutorialElementHelper key={key} setRef={setRef}><Enable1v1ModeFeature small /></HighlightTutorialElementHelper>}</HLTElement>}
      img=""
      {...props}
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

const ScrimsCard = memo((props: CardProps) => {
  return (
    <OnboardingCard
      enabled={false}
      icon={<Group />}
      title="Mode: Scrims/Tournaments"
      img=""
      {...props}
    >
      <Alert variant="outlined" severity="warning" style={{ height: '100%', display: 'flex', alignItems: 'center' }}>This mode is not yet available.</Alert>
    </OnboardingCard>
  );
});
ScrimsCard.displayName = 'ScrimsCard';

const CalloutCard = memo((props: CardProps) => {
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
      {...props}
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

const SmartFeaturesCard = memo((props: CardProps) => {
  return (
    <OnboardingCard
      icon={<TipsAndUpdates />}
      title={<Stack direction={'row'} spacing={1} alignItems={'center'}><span>Smart Features</span><Chip size="small" color="warning" label="EXPERIMENTAL" /></Stack>}
      enableDisable={<EnableSmartFeatures />}
      enabled={BACKGROUND_SETTINGS.hook(s => s.enableSmartFeatures)}
      img=""
      {...props}
    >
      <Stack spacing={1}>
        <small style={{ opacity: .6 }}>
          Allows the app to detect the game state using screenshots.
          Disable this if you notice problems with your performance.
        </small>
        <Stack direction={'row'} alignItems={'center'} fontSize={'.8em'}>
          <Stack flexGrow={1}>
            <span>Auto-Detect current map</span>
            <small style={{ opacity: .6 }}>This allows to auto-select callout graphics.</small>
          </Stack>
          <EnableMapDetectionFeature small />
        </Stack>
        <Stack direction={'row'} alignItems={'center'} fontSize={'.8em'}>
          <Stack flexGrow={1}>
            <span>Auto-Detect killers</span>
            <small style={{ opacity: .6 }}>Tries to identify the current killer for stats and switch between M1/M2 for timer-start.</small>
          </Stack>
          <EnableKillerDetectionFeature small />
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
    <AppHighlightTutorialWrapper>
      <Stack width="100%" height="100%" alignItems="center" justifyContent="center" spacing={1}>
        <Stack>
          <Typography variant="h5">Welcome to Fog Companion for competitive Dead by Daylight</Typography>
          <Link variant="caption" style={{ opacity: .8 }} onClick={() => useHighlightTutorial.getState().start(HomeViewTutorial)}><Help sx={{ fontSize: 12 }} /> Learn what this app can do for you</Link>
        </Stack>
        <Grid container flexGrow={1} spacing={1} width="100%">
          <HLTElement {...HomeViewTutorial.ModeCards}>
            {(key, setRef, highlighted) => <TimerCard buttonTutorial key={key} setRef={setRef} />}
          </HLTElement>
          <ScrimsCard />
          <HLTElement {...HomeViewTutorial.CalloutCard}>
            {(key, setRef, highlighted) => <CalloutCard key={key} setRef={setRef} />}
          </HLTElement>
          <HLTElement {...HomeViewTutorial.SmartFeaturesCard}>
            {(key, setRef, highlighted) => <SmartFeaturesCard key={key} setRef={setRef} />}
          </HLTElement>
        </Grid>
        <Stack direction={'row'} spacing={4} alignItems={"center"} width={'100%'}>
          <span style={{ flexGrow: 1 }} />
          <HLTElement {...HomeViewTutorial.SecondMonitorCheck}>
            {(key, setRef, highlighted) => (<FormControlLabel
              style={{ opacity: .75 }}
              key={key}
              ref={setRef}
              label={<Stack><span>Use this window in-game.</span><small>Disable for second-screen use.</small></Stack>}
              control={<Checkbox checked={showInGame} onChange={handleShowInGame} size="small" />}
            />)}
          </HLTElement>
          <HLTElement {...HomeViewTutorial.OpenOnStartupCheck}>
            {(key, setRef, highlighted) => (<FormControlLabel
              style={{ opacity: .75 }}
              key={key}
              ref={setRef}
              label={<Stack><span>Open this window with DBD</span><small>Disable to only open manually.</small></Stack>}
              control={<Checkbox checked={openOnStartup} onChange={handleOpenOnStartup} size="small" />}
            />)}
          </HLTElement>
          <span style={{ flexGrow: 1 }} />
        </Stack>
      </Stack >
    </AppHighlightTutorialWrapper>
  );
};
