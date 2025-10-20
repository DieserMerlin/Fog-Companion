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
    OWHotkeys.onHotkeyDown(kHotkeys.mapUp, () => useMapBrowserNavigation.getState().previous());
    OWHotkeys.onHotkeyDown(kHotkeys.mapDown, () => useMapBrowserNavigation.getState().next());
    OWHotkeys.onHotkeyDown(kHotkeys.mapLeft, () => useMapBrowserNavigation.getState().close());
    OWHotkeys.onHotkeyDown(kHotkeys.mapRight, () => useMapBrowserNavigation.getState().open());
  }

}

Callouts.instance();

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<CalloutApp />);
