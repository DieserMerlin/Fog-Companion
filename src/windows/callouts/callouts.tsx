import {
  OWHotkeys
} from "@overwolf/overwolf-api-ts";

import { AppWindow } from "../../AppWindow";
import { kHotkeys, kWindowNames } from "../../consts";

import ReactDOM from "react-dom/client";
import { CalloutApp, useCalloutOrientation } from "./callout-app";

import { useMapBrowserNavigation } from "./browser/use-map-browser-navigation";
import { CALLOUT_SETTINGS, useCalloutVariant } from "./callout-settings";

export class Callouts extends AppWindow {
  private static _instance: Callouts;

  private constructor() {
    super(kWindowNames.callouts);

    this.setToggleHotkeyBehavior();

    overwolf.windows.getMainWindow().bus.on('game-info', state => {
      if (!state) return;

      overwolf.windows.getCurrentWindow(w => {
        const { top, width, height, left } = w.window;
        const { width: gameWidth, height: gameHeight } = state;
        const windowCenterX = left + width / 2;
        const side = windowCenterX < gameWidth / 2 ? 'left' : 'right';
        useCalloutOrientation.setState(side);
      });
    });
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new Callouts();
    }

    return this._instance;
  }

  private async setToggleHotkeyBehavior() {
    OWHotkeys.onHotkeyDown(kHotkeys.mapSwitchVar, () => useCalloutVariant.getState().next());
    OWHotkeys.onHotkeyDown(kHotkeys.mapToggleBrowser, () => {
      const current = CALLOUT_SETTINGS.getValue().browser;
      CALLOUT_SETTINGS.update({ browser: !current });
    });
    overwolf.games.inputTracking.onKeyDown.addListener(e => this.navigateMapBrowser(e.key))
  }

  private async navigateMapBrowser(key: string) {
    if (!CALLOUT_SETTINGS.getValue().browser) return;
    const api = useMapBrowserNavigation.getState();

    console.log('key', key);

    if (["87", "38"].includes(key)) // Up, W
      api.previous();
    if (["83", "40"].includes(key)) // Down, S
      api.next();
    if (["65", "37"].includes(key)) // Left, A
      api.close();
    if (["68", "39", "13", "32"].includes(key)) // Right, D, Space, Enter
      api.open();
  }
}

Callouts.instance();

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<CalloutApp />);
