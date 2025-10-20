import {
  OWGames,
  OWHotkeys,
  OWWindow,
} from "@overwolf/overwolf-api-ts";

import { createRoot } from 'react-dom/client';
import { AppWindow } from "../../AppWindow";
import { kHotkeys, kWindowNames } from "../../consts";
import { BaseWindow } from "../../utils/window/AppWindow";
import { Mode1v1TimerAPI, Render1v1Overlay } from "./mode_1v1-app";
import { MODE_1V1_SETTINGS } from "./mode_1v1-settings";


class Mode1v1 extends AppWindow {

  private static _instance: Mode1v1;

  private constructor() {
    super(kWindowNames.mode_1v1);

    this.setHotkeyBehavior();
    this.initResize();
  }

  private timerApi: Mode1v1TimerAPI;
  setTimerApi(api: Mode1v1TimerAPI) {
    this.timerApi = api;
  }

  async initResize() {
    if (!!localStorage.getItem('1v1_resized')) return;

    const gameInfo = await OWGames.getRunningGameInfo();
    const windowInfo = await OWWindow.getCurrentInfo();

    const pos = { y: 0, x: gameInfo.logicalWidth / 2 - windowInfo.width / 2 };
    overwolf.windows.changePosition('mode_1v1', pos.x, pos.y);

    localStorage.setItem('1v1_resized', "1");
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new Mode1v1();
    }

    return this._instance;
  }


  private async setHotkeyBehavior() {
    OWHotkeys.onHotkeyDown(kHotkeys.mode1v1switchToSurv, () => MODE_1V1_SETTINGS.update({ selected: 'survivor' }));
    OWHotkeys.onHotkeyDown(kHotkeys.mode1v1switchToKllr, () => MODE_1V1_SETTINGS.update({ selected: 'killer' }));
    OWHotkeys.onHotkeyDown(kHotkeys.mode1v1resetTimer, () => this.timerApi.onReset());
    OWHotkeys.onHotkeyDown(kHotkeys.mode1v1resetTimers, () => this.timerApi.onResetBoth());
    OWHotkeys.onHotkeyDown(kHotkeys.mode1v1startStopTimer, () => this.timerApi.onStartStop());

    overwolf.games.inputTracking.onKeyDown.addListener(e => {
      if (e.key === '50') this.timerApi.onEmote();
      if (e.key === '162') this.timerApi.onCrouch();
    });
    overwolf.games.inputTracking.onMouseDown.addListener(e => {
      this.timerApi.onSwing(e.button === 'left' ? 'm1' : 'm2');
    })
  }
}

Mode1v1.instance();

const root = createRoot(document.getElementById('root')!);
root.render(
  <BaseWindow fullWindowDrag transparent>
    <Render1v1Overlay onApi={api => Mode1v1.instance().setTimerApi(api)} />
  </BaseWindow>
);