import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { PropsWithChildren, ReactElement, memo, useCallback, useState } from "react";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import { Accordion } from '../../../utils/mui/Accordion';
import { BACKGROUND_SETTINGS } from '../../background/background-settings';
import { CALLOUT_SETTINGS } from '../../callouts/callout-settings';
import { MODE_1V1_SETTINGS } from '../../mode_1v1/mode_1v1-settings';
import { AppCustomMapSettings } from "./AppCustomMapSettings";
import { SettingsHotkey } from './AppSettingsHotkey';
import { Enable1v1ModeFeature, EnableKillerDetectionFeature, EnableMapDetectionFeature } from './EnableDisableFeatures';
import { AppSettingsSection, useAppSettings } from './use-app-settings';
import { MapBrowserHotkeys } from './MapBrowserHotkeys';

/** ---------- Primitives ---------- */

const SmartFeaturesNotice = () => {
  const enabled = BACKGROUND_SETTINGS.hook(s => s.enableSmartFeatures);

  if (enabled) return null;
  return <small style={{ color: 'red' }}>Smart Features are disabled.</small>
}

const SettingsSection = memo((
  props: PropsWithChildren<{
    label: string;
    description: string;
    expanded?: boolean;
    onExpand?: (expand: boolean) => void;
    disabled?: true;
  }>
) => {
  return (
    <Accordion
      expanded={props.expanded}
      onChange={(_, e) => props.onExpand?.(e)}
      disabled={props.disabled}
    >
      <AccordionSummary disabled={props.disabled}>
        <Stack>
          <Typography variant="h5" component="div">
            {props.label}
          </Typography>
          <Typography gutterBottom variant="caption" sx={{ color: 'text.secondary', fontSize: 14 }}>
            {props.description}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={.5}>
          {props.children}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
});
SettingsSection.displayName = 'SettingsSection';

const SettingsOption = memo((
  props: PropsWithChildren<{
    label: ReactElement | string;
    description: ReactElement | string;
    disabled?: true;
  }>
) => {
  return (
    <Paper style={props.disabled && { opacity: .6, pointerEvents: 'none' } || undefined}>
      <Stack spacing={1} p={2} direction="row" alignItems="center">
        <Stack minWidth="40%" maxWidth="40%">
          <Typography variant="body1" component="div">
            {props.label}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {props.description}
          </Typography>
        </Stack>
        <Stack style={{ flexGrow: 1 }} spacing={1} justifyContent="right" alignItems="center" direction="row">
          {props.children}
        </Stack>
      </Stack>
    </Paper>
  );
});
SettingsOption.displayName = 'SettingsOption';

/** ---------- Block: Callout Overlay ---------- */

const CalloutOverlaySettings = memo(() => {
  // Localized subscriptions so only this block re-renders on these updates
  const calloutOverlay = BACKGROUND_SETTINGS.hook(s => s.calloutOverlay);

  const size = CALLOUT_SETTINGS.hook(s => s.size);
  const opacity = CALLOUT_SETTINGS.hook(s => s.opacity);
  const showHotkeysCallout = CALLOUT_SETTINGS.hook(s => s.showHotkeys);

  const handleToggleOverlay = useCallback((_: unknown, v: boolean) => {
    BACKGROUND_SETTINGS.update({ calloutOverlay: v });
  }, []);

  const handleSize = useCallback((_: unknown, v: number | number[]) => {
    CALLOUT_SETTINGS.update({ size: v as number });
  }, []);

  const handleOpacity = useCallback((_: unknown, v: number | number[]) => {
    CALLOUT_SETTINGS.update({ opacity: v as number });
  }, []);

  const handleShowHotkeys = useCallback((_: unknown, v: boolean) => {
    CALLOUT_SETTINGS.update({ showHotkeys: v });
  }, []);

  const [customMapsManager, setCustomMapsManager] = useState(false);

  return (
    <>
      <Stack p={1}>
        <Typography variant="overline">General</Typography>
      </Stack>

      <SettingsOption label="Enabled" description="Whether the map overlay should be enabled.">
        <SettingsHotkey name="map_showhide" />
        <Switch checked={calloutOverlay} onChange={handleToggleOverlay} />
      </SettingsOption>

      <Dialog fullScreen open={customMapsManager} onClose={() => setCustomMapsManager(false)}>
        <AppCustomMapSettings onClose={() => setCustomMapsManager(false)} />
      </Dialog>
      <SettingsOption label="Custom graphics" description="Manage your custom callout graphics">
        <Button onClick={() => setCustomMapsManager(true)}>Open manager</Button>
      </SettingsOption>

      {calloutOverlay && (
        <>
          <SettingsOption label="Open Browser" description="Use this hotkey to open the map browser and show a map manually.">
            <SettingsHotkey name="map_browser" />
          </SettingsOption>

          <SettingsOption label="Browser Navigation" description="Use these hotkeys to navigate the browser.">
            <MapBrowserHotkeys />
          </SettingsOption>

          <Stack p={1}>
            <Typography variant="overline">Behaviour</Typography>
          </Stack>

          <SettingsOption
            label="Recognize Current Map"
            description={<>If enabled, the app will try to find out the current map and open the overlay automatically.<br /><SmartFeaturesNotice /></>}
          >
            <Alert severity="warning" variant="outlined">
              <b>EXPERIMENTAL</b><br />
              The app is guessing maps based on the text in the lower left corner on the screen while the match starts.
              If you're tabbed out during that moment, the recognition won't work.
            </Alert>
            <EnableMapDetectionFeature />
          </SettingsOption>

          <Stack p={1}>
            <Typography variant="overline">Display Settings</Typography>
          </Stack>

          <SettingsOption label="Overlay Size" description="Control the overlay size.">
            <Slider min={0} max={1} step={0.01} value={size} onChange={handleSize} />
          </SettingsOption>

          <SettingsOption label="Overlay Opacity" description="Control how transparent the callout-overlay shall be.">
            <Slider min={.3} max={1} step={0.01} value={opacity} onChange={handleOpacity} />
          </SettingsOption>

          <SettingsOption label="Show hotkeys" description="Whether the map overlay should show hints about available shortcuts.">
            <Switch checked={showHotkeysCallout} onChange={handleShowHotkeys} />
          </SettingsOption>
        </>
      )}
    </>
  );
});
CalloutOverlaySettings.displayName = 'CalloutOverlaySettings';

/** ---------- Block: Mode 1v1 ---------- */

const Mode1v1Settings = memo(() => {
  const startKllrOnSwing = MODE_1V1_SETTINGS.hook(s => s.startKllrOnSwing);
  const startSurvOnCrouch = MODE_1V1_SETTINGS.hook(s => s.startSurvOnCrouch);
  const stopOnEmote = MODE_1V1_SETTINGS.hook(s => s.stopOnEmote);
  const showMs = MODE_1V1_SETTINGS.hook(s => s.showMs);
  const showHotkeys = MODE_1V1_SETTINGS.hook(s => s.showHotkeys);
  const enableKillerDetection = BACKGROUND_SETTINGS.hook(s => s.enableKillerDetection);

  const handleStartKiller = useCallback((_: unknown, v: boolean) => {
    MODE_1V1_SETTINGS.update({ startKllrOnSwing: v });
  }, []);

  const handleStartSurvivor = useCallback((_: unknown, v: boolean) => {
    MODE_1V1_SETTINGS.update({ startSurvOnCrouch: v });
  }, []);

  const handleStopOnEmote = useCallback((_: unknown, v: boolean) => {
    MODE_1V1_SETTINGS.update({ stopOnEmote: v });
  }, []);

  const handleShowMs = useCallback((_: unknown, v: boolean) => {
    MODE_1V1_SETTINGS.update({ showMs: v });
  }, []);

  const handleShowHotkeys = useCallback((_: unknown, v: boolean) => {
    MODE_1V1_SETTINGS.update({ showHotkeys: v });
  }, []);

  const handleKillerDetection = useCallback((_: unknown, v: boolean) => {
    BACKGROUND_SETTINGS.update({ enableKillerDetection: v });
  }, []);

  return (
    <>
      <Stack p={1}>
        <Typography variant="overline">General</Typography>
      </Stack>

      <SettingsOption label="Mode Enabled" description="Use this hotkey to switch to or out of the 1v1 mode.">
        <Enable1v1ModeFeature />
      </SettingsOption>

      <SettingsOption label="Killer Detection" description={<>Enable/Disable detection of Blight and Nurse to start the timer with M2.<br /><SmartFeaturesNotice /></>}>
        <EnableKillerDetectionFeature />
      </SettingsOption>

      <SettingsOption label={<>Switch to <b>Killer</b></>} description="Use this hotkey to switch to the killer timer.">
        <SettingsHotkey name="mode_1v1_switch_kllr" />
      </SettingsOption>

      <SettingsOption label={<>Switch to <b>Survivor</b></>} description="Use this hotkey to switch to the survivor timer.">
        <SettingsHotkey name="mode_1v1_switch_surv" />
      </SettingsOption>

      <SettingsOption label={<>Universally Start/Stop Timer</>} description="Use this hotkey to start/stop any selected timer.">
        <SettingsHotkey name="mode_1v1_start_stop_timer" />
      </SettingsOption>

      <SettingsOption label={<>Reset Current Timer</>} description="Use this hotkey to reset the selected timer.">
        <SettingsHotkey name="mode_1v1_reset_timer" />
      </SettingsOption>

      <SettingsOption label={<>Reset Both Timers</>} description="Use this hotkey to reset both timers.">
        <SettingsHotkey name="mode_1v1_reset_timers" />
      </SettingsOption>

      <Stack p={1}>
        <Typography variant="overline">Start/Stop timers comfortably</Typography>
        <Alert severity="warning" variant="outlined">
          These keys (<b>M1</b>, <b>M2</b>, <b>Ctrl</b>) are not rebindable, That's a limitation of overwolf.
          You can disable them and bind something to the <b>Universally Start/Stop Timer</b> hotkey.
          <br />
          These Hotkeys are only listened to when the app considers your game to be in a match.
        </Alert>
      </Stack>

      <SettingsOption
        label={<><b>Killer</b>: Start on Swing/Rush (<b>M1</b>/<b>M2</b>)</>}
        description={<>If enabled, the killer timer will be started on <b>M1</b> or <b>M2</b>.</>}
      >
        <Alert severity="info" variant="outlined">
          I'm aware that <b>M2</b> is not great for Wraith. There might be a killer detection itf. Until then, uncloak and reset the timer.
        </Alert>
        <Switch checked={startKllrOnSwing} onChange={handleStartKiller} />
      </SettingsOption>

      <SettingsOption
        label={<><b>Survivor</b>: Start on Crouch (<b>Ctrl</b>)</>}
        description={<>If enabled, the survivor timer will be started on <b>Ctrl</b>.</>}
      >
        <Switch checked={startSurvOnCrouch} onChange={handleStartSurvivor} />
      </SettingsOption>

      <SettingsOption
        label={<><b>Both</b>: Stop on Emote (<b>2</b>)</>}
        description={<>If enabled, the timer will be stopped on <b>2</b>.</>}
      >
        <Switch checked={stopOnEmote} onChange={handleStopOnEmote} />
      </SettingsOption>

      <Stack p={1}>
        <Typography variant="overline">Display settings</Typography>
      </Stack>

      <SettingsOption
        label="Display Milliseconds"
        description={<>Timer will be shown as <b>MM:SS:mm</b> if enabled and as <b>MM:SS</b> otherwise.</>}
      >
        <Switch checked={showMs} onChange={handleShowMs} />
      </SettingsOption>

      <SettingsOption
        label="Display Hotkeys"
        description="Whether your keybinds should display on the overlay."
      >
        <Switch checked={showHotkeys} onChange={handleShowHotkeys} />
      </SettingsOption>
    </>
  );
});
Mode1v1Settings.displayName = 'Mode1v1Settings';

/** ---------- Root ---------- */

export const AppSettings = () => {
  const expand = useAppSettings(s => s.expand);
  const handleExpanded = useCallback(
    (id: number) => (e: boolean) => useAppSettings.setState({ expand: e ? id : null }),
    []
  );

  return (
    <Stack>
      <SettingsSection
        expanded={expand === AppSettingsSection.CALLOUT}
        onExpand={handleExpanded(0)}
        label="Callout-Overlay"
        description="Options to control the clock-callouts."
      >
        <CalloutOverlaySettings />
      </SettingsSection>

      <SettingsSection
        expanded={expand === AppSettingsSection.MODE_1v1}
        onExpand={handleExpanded(1)}
        label="Mode: 1v1"
        description="A timer tool to track your time in-game."
      >
        <Mode1v1Settings />
      </SettingsSection>

      <SettingsSection disabled label="Mode: Scrim/Tournament" description="Yet to be implemented" />
    </Stack>
  );
};
