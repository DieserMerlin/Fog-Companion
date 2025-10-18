import Link from "@mui/material/Link";
import { AppSettingsSection, useAppSettings } from "../../settings/use-app-settings";
import { IngameAppTab, useIngameApp } from "../../use-ingame-app";
import { CloseTutorialConfirmation, Tutorial, useTutorial } from "../AppTutorial";
import { SettingsHotkey } from "../../settings/AppSettingsHotkey";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import { Enable1v1ModeFeature } from "../../settings/EnableDisableFeatures";

const open1v1Settings = () => { useIngameApp.setState({ tab: IngameAppTab.SETTINGS }); useAppSettings.setState({ expand: AppSettingsSection.MODE_1v1 }); };
const SettingsLink = () => <CloseTutorialConfirmation onClose={open1v1Settings}>Settings</CloseTutorialConfirmation>;

export const MODE_1V1_TUTORIAL: Tutorial = {
  title: '1v1 Mode',
  content: (
    <>
      <span>Track chase time in DBD with a simple overlay.</span>
      <span>
        You can:
        <ul>
          <li>Time chases as <b>Survivor</b> or <b>Killer</b></li>
          <li>Start by <b>Crouching</b> <small>(Ctrl)</small> or <b>Swinging/Bumping</b> <small>(M1/M2)</small></li>
          <li>Stop by <b>Emoting</b> <small>(2)</small></li>
        </ul>
      </span>
    </>
  ),
  notice: <>Turn this feature on/off: <Enable1v1ModeFeature /></>,
  steps: [
    {
      title: 'Enter 1v1 Mode',
      content: (
        <>
          <span>Press <SettingsHotkey name="mode_1v1" /> to enable the overlay.</span>
          <span>Toggle timers between <b>Survivor</b> (<SettingsHotkey name="mode_1v1_switch_surv" />) and <b>Killer</b> (<SettingsHotkey name="mode_1v1_switch_kllr" />).</span>
        </>
      ),
      media: { type: 'image', src: ["./img/tutorial/timer1.jpg", "./img/tutorial/timer4.jpg"], position: 'top left' }
    },
    {
      title: 'Start the timer',
      content: (
        <>
          <Stack>
            <span>Survivor: <b>Crouch</b> <small>(Ctrl)</small>. Killer: <b>Swing/Bump</b> <small>(M1/M2)</small>.</span>
            <span>Hotkeys auto-enable only <b>in trial</b>.</span>
          </Stack>
          <Alert variant="outlined">
            Starts only when the timer reads <b>00:00:00</b> (so you can still crouch while being in chase) and you’re <b>in a trial</b>.
          </Alert>
        </>
      ),
      notice: <>You can turn this off in <SettingsLink />.</>,
      media: { type: 'video', src: './videos/5.mp4', position: 'center' }
    },
    {
      title: 'Stop the timer',
      content: (
        <>
          <Stack>
            <span><b>Emote</b> <small>(2)</small> to stop — same for Survivor and Killer.</span>
          </Stack>
          <Alert variant="outlined" severity="warning">
            You cannot rebind this unfortunately.<br />If you need a custom key, disable this feature and bind the <b>Timer Start/Stop Hotkey</b> (next slide).
          </Alert>
        </>
      ),
      notice: <>You can turn this off in <SettingsLink />.</>,
      media: { type: 'video', src: './videos/6.mp4', position: 'center' }
    },
    {
      title: 'Manual controls',
      content: (
        <>
          <span>Universal hotkeys:</span>
          <Stack spacing={1}>
            <span><SettingsHotkey name="mode_1v1_start_stop_timer" /> — <b>Start/Stop</b> current timer</span>
            <span><SettingsHotkey name="mode_1v1_reset_timer" /> — <b>Reset</b> current timer to 00:00:00</span>
            <span><SettingsHotkey name="mode_1v1_reset_timers" /> — <b>Reset both</b> timers</span>
          </Stack>
        </>
      )
    },
    {
      title: 'Customize',
      content: (
        <>
          <span>Tweak the overlay to fit your setup:</span>
          <span>
            <ul>
              <li>Show <b>Seconds</b> or <b>Milliseconds</b> in <SettingsLink />.</li>
              <li>Show/Hide <b>Hotkeys</b> in <SettingsLink />.</li>
              <li>Move the overlay via <b>Overwolf</b> (default: <b>Ctrl+Tab</b>).</li>
            </ul>
          </span>
        </>
      ),
      media: { type: 'image', src: ["./img/tutorial/timer1.jpg", "./img/tutorial/timer2.jpg", "./img/tutorial/timer3.jpg"], position: 'top left' },
      notice: <>Visual themes are planned.</>
    }
  ]
}