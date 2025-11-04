import {
  OWHotkeys
} from "@overwolf/overwolf-api-ts";

import { Mode1v1TimerRef, RenderMode1v1Timer } from 'fog-companion-web';
import { createRoot } from 'react-dom/client';
import { AppWindow } from "../../AppWindow";
import { kHotkeys, kWindowNames } from "../../consts";
import { GameStateType } from "../../game_state/GameState";
import { useGameState } from "../../utils/hooks/gamestate-hook";
import { useHotkeys } from "../../utils/hooks/hotkey-hook";
import { BaseWindow } from "../../utils/window/AppWindow";
import { MODE_1V1_SETTINGS, useMode1v1Theme } from "./mode_1v1-settings";


class Mode1v1 extends AppWindow {

  private static _instance: Mode1v1;

  private constructor() {
    super(kWindowNames.mode_1v1);

    this.setHotkeyBehavior();
    useMode1v1Theme.subscribe((curr, prev) => curr.theme.hash !== prev.theme.hash && this.resize());
    this.resize();
  }

  private timerApi: Mode1v1TimerRef;
  private unsubscribeListener: () => void;
  setTimerApi(api: Mode1v1TimerRef) {
    this.timerApi = api;
    if (!api) return;

    api.switchMode(MODE_1V1_SETTINGS.getValue().selected);

    this.unsubscribeListener?.();
    this.unsubscribeListener = MODE_1V1_SETTINGS.hook.subscribe(s => api.switchMode(s.selected));
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new Mode1v1();
    }

    return this._instance;
  }

  private async resize() {
    const { theme } = useMode1v1Theme.getState();
    const gi = overwolf.windows.getMainWindow().gameInfo;

    const percentRegex = /^\d+\%$/;
    const pxRegex = /^\d+px$/;

    let width = 0, height = 0;

    if (percentRegex.test(theme.data.width)) {
      // Calculate screen percent
      const factor = parseInt(theme.data.width.replace('%', '')) / 100;
      if (gi) width = factor * gi.width;
    }
    else if (pxRegex.test(theme.data.width)) {
      // Set px
      width = parseInt(theme.data.width.replace('px', ''));
    }

    if (percentRegex.test(theme.data.height)) {
      const factor = parseInt(theme.data.height.replace('%', '')) / 100;
      if (gi) height = factor * gi.height;
    }
    else if (pxRegex.test(theme.data.height)) {
      height = parseInt(theme.data.height.replace('px', ''));
    }

    if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
      width = 0;
      height = 0;
    }

    console.log(`SETTING SIZE: ${width}x${height}`)
    const window = await new Promise<overwolf.windows.WindowResult>(res => overwolf.windows.getCurrentWindow(w => res(w)));
    console.log('RESIZE WINDOW:', window);
    const res = await new Promise<overwolf.Result>((res) => overwolf.windows.changeSize({ window_id: window.window.id, width, height, auto_dpi_resize: true }, _res => res(_res)));
    console.log('RESIZE RES:', res);
  }


  private async setHotkeyBehavior() {
    OWHotkeys.onHotkeyDown(kHotkeys.mode1v1switchToSurv, () => MODE_1V1_SETTINGS.update({ selected: 'surv' }));
    OWHotkeys.onHotkeyDown(kHotkeys.mode1v1switchToKllr, () => MODE_1V1_SETTINGS.update({ selected: 'kllr' }));
    OWHotkeys.onHotkeyDown(kHotkeys.mode1v1resetTimer, () => this.timerApi.resetTimer());
    OWHotkeys.onHotkeyDown(kHotkeys.mode1v1resetTimers, () => this.timerApi.resetTimers());
    OWHotkeys.onHotkeyDown(kHotkeys.mode1v1startStopTimer, () => this.timerApi.startStop());

    overwolf.games.inputTracking.onKeyDown.addListener(e => {
      if (e.key === '50') this.timerApi.handleEmote();
      if (e.key === '162') this.timerApi.handleCrouch();
    });
    overwolf.games.inputTracking.onMouseDown.addListener(e => {
      this.timerApi[e.button === 'left' ? 'handleM1' : 'handleM2']();
    })
  }
}

Mode1v1.instance();

const Mode1v1App = () => {
  const theme = useMode1v1Theme(s => s.theme);
  const hotkeys = useHotkeys();

  const inMatch = useGameState(s => s.state.type === GameStateType.MATCH);
  const startKillerType = useGameState(s => s.state.killer?.start?.m2 ? 'M2' : 'M1'); // TODO allow multiple
  const startKillerText = useGameState(s => s.state.killer?.start?.label);

  const startOnCrouch = MODE_1V1_SETTINGS.hook(s => s.startSurvOnCrouch);
  const startOnSwing = MODE_1V1_SETTINGS.hook(s => s.startKllrOnSwing);
  const stopOnEmote = MODE_1V1_SETTINGS.hook(s => s.stopOnEmote);
  const showHotkeys = MODE_1V1_SETTINGS.hook(s => s.showHotkeys);
  const showMs = MODE_1V1_SETTINGS.hook(s => s.showMs);

  return (
    <BaseWindow fullWindowDrag transparent>
      <RenderMode1v1Timer
        key={'mode-1v1-timer-app'}
        ref={api => Mode1v1.instance().setTimerApi(api)}
        theme={theme}
        hotkeys={hotkeys}
        inMatch={inMatch}
        names={{ opponent: '', self: '' }}
        startKillerType={startKillerType}
        startKillerText={startKillerText}
        startOnCrouch={startOnCrouch}
        startOnSwing={startOnSwing}
        stopOnEmote={stopOnEmote}
        showHotkeys={showHotkeys}
        showMs={showMs}
        bg="transparent"
        onState={console.log}
      />
    </BaseWindow>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Mode1v1App />);