import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import { SettingsHotkey } from "../../settings/AppSettingsHotkey";
import { EnableCalloutFeature } from "../../settings/EnableDisableFeatures";
import { AppSettingsSection, useAppSettings } from "../../settings/use-app-settings";
import { IngameAppTab, useIngameApp } from "../../use-ingame-app";
import { CloseTutorialConfirmation, Tutorial, useTutorial } from "../AppTutorial";
import Link from "@mui/material/Link";
import { OverwolfLink } from "../../../../utils/mui/OverwolfLink";
import { MapBrowserHotkeys } from "../../settings/MapBrowserHotkeys";

const openCalloutSettings = () => { useIngameApp.setState({ tab: IngameAppTab.SETTINGS }); useAppSettings.setState({ expand: AppSettingsSection.MODE_1v1 }); };
const openAbout = () => { useIngameApp.setState({ tab: IngameAppTab.ABOUT }); };
const SettingsLink = () => <CloseTutorialConfirmation onClose={openCalloutSettings}>Settings</CloseTutorialConfirmation>;
const AboutLink = () => <CloseTutorialConfirmation onClose={openAbout}>About-Tab</CloseTutorialConfirmation>;

export const CALLOUT_TUTORIAL: Tutorial = {
  title: 'Callout Overlay 🗺️',
  content: (
    <>
      <Stack>
        <span>Need a cheat sheet?</span>
        <span>I got you! Fully customizable map overlays.</span>
      </Stack>
      <span>Change <b>Size</b>, <b>Opacity</b>, and display of <b>Hotkeys</b> in the <SettingsLink />.</span>
      <span>Move the map to another position on the <b>Overwolf Overlay</b>.</span>
    </>
  ),
  notice: <>Turn this feature on/off: <EnableCalloutFeature /></>,
  media: { type: 'video', src: './videos/1.mp4', position: 'right' },
  steps: [
    {
      title: 'Work smart, not hard 🧠',
      content: (
        <>
          <span>The <b>auto-detection</b> selects the correct map overlay automatically!</span>
          <Stack>
            <span>How it works?</span>
            <span>I take periodic peeks at your game and recognize the text in the lower-left corner at trial start!</span>
          </Stack>
          <span>After the trial, the map gets de-selected automatically.</span>
          <Alert variant="outlined" severity="warning">
            Two things to consider:
            <ul>
              <li>DBD needs to be in focus for it to work, so <b>don’t tab out while the match starts</b>!</li>
              <li>The text must be clearly visible. <b>Avoid placing any overlays there.</b></li>
            </ul>
          </Alert>
          <span>Also, this is experimental and a bit hacky ngl 😅</span>
        </>
      ),
      notice: <>This feature can be disabled in the <SettingsLink />.</>,
      media: { type: 'video', src: './videos/3.mp4', position: 'left' }
    },
    {
      title: 'Switch map variants',
      content: (
        <Stack>
          <span>Some maps have multiple variations with the same name.</span>
          <span>On those, you can switch variants using <SettingsHotkey name="map_switch_variant" />.</span>
        </Stack>
      ),
      notice: "You can also switch between custom graphics (next slides) and default ones!",
      media: { type: 'video', src: './videos/4.mp4', position: 'left' }
    },
    {
      title: 'Select maps manually',
      content: (
        <>
          <Stack>
            <span>The Auto-Detection failed or you want to choose a map manually?</span>
            <span>Open the <b>Map Browser</b> using <SettingsHotkey name="map_browser" />.</span>
          </Stack>
          <span>Use these hotkeys to navigate the <b>Map Browser</b>:</span>
          <MapBrowserHotkeys />
        </>
      ),
      notice: ' Be aware that having auto-detection on will prioritize the auto-detected map.',
      media: { type: 'video', src: './videos/2.mp4', position: 'left' }
    },
    {
      title: 'Want custom graphics?',
      content: (
        <>
          <Stack>
            <span>The default overlay graphics are those from <OverwolfLink href='https://hens333.com'>Hens</OverwolfLink>!</span>
            <span>See how to use your own graphics in the <SettingsLink />.</span>
          </Stack>
        </>
      ),
      notice: <>Also, if you have contact to Hens, please see the <AboutLink />.</>
    }
  ]
}