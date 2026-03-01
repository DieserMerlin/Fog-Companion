import {
  OWHotkeys
} from "@overwolf/overwolf-api-ts";

import { Mode1v1TimerRef, RenderMode1v1Timer } from '@diesermerlin/fog-companion-web';
import { createRoot } from 'react-dom/client';
import { AppWindow } from "../../AppWindow";
import { kHotkeys, kWindowNames } from "../../consts";
import { GameStateType } from "../../game_state/GameState";
import { useGameState } from "../../utils/hooks/gamestate-hook";
import { useHotkeys } from "../../utils/hooks/hotkey-hook";
import { BaseWindow } from "../../utils/window/AppWindow";
import { MODE_1V1_SETTINGS, MODE_1V1_THEME, useMode1v1Theme } from "./mode_1v1-settings";
import { Mode1v1Manager } from "../main/mode-1v1/mode-1v1-manager";
import { MODE_1V1_STATE } from "./use-mode-1v1-state";
import { useCurrent1v1Challenge } from "./use-current-1v1-challenge";
import { useEffect, useMemo, useRef } from "react";
import stringify from 'json-stringify-deterministic';

class Mode1v1 extends AppWindow {
  private static _instance: Mode1v1;

  private constructor() {
    super(kWindowNames.mode_1v1);

    this.setHotkeyBehavior();
    MODE_1V1_THEME.hook.subscribe((curr, prev) => stringify(curr.theme) !== stringify(prev.theme) && this.resize());
    this.resize();
  }

  private timerApi: Mode1v1TimerRef | null;
  private unsubscribeListener: () => void;
  setTimerApi(api: Mode1v1TimerRef) {
    this.timerApi = api;
    overwolf.windows.getMainWindow().mode1v1TimerApi = api;

    this.unsubscribeListener?.();
    if (!api) return;

    api.switchMode(MODE_1V1_SETTINGS.getValue().selected);

    const unsubscribeHook = MODE_1V1_SETTINGS.hook.subscribe(s => api?.switchMode(s.selected));

    this.unsubscribeListener = () => {
      unsubscribeHook();
    };
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new Mode1v1();
    }

    return this._instance;
  }

  private async resize() {
    const { theme } = MODE_1V1_THEME.getValue();
    const gi = overwolf.windows.getMainWindow().gameInfo;

    let width = 0, height = 0;

    if (theme.data.size.width.mode === '%') {
      // Calculate screen percent
      const factor = theme.data.size.width.size / 100;
      if (gi) width = factor * gi.width;
    }
    else {
      // Set px
      width = theme.data.size.width.size
    }
    if (theme.data.size.height.mode === '%') {
      const factor = theme.data.size.height.size / 100;
      if (gi) height = factor * gi.height;
    }
    else {
      height = theme.data.size.height.size;
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

    const first = !localStorage.getItem('1v1Resized');
    if (first) {
      localStorage.setItem('1v1Resized', '1');
      await new Promise<overwolf.Result>(res => overwolf.windows.changePosition(window.window.id, gi.width / 2 - width / 2, 10, _res => res(_res)));
    }
  }


  private async setHotkeyBehavior() {
    OWHotkeys.onHotkeyDown(kHotkeys.mode1v1switchToSurv, () => MODE_1V1_SETTINGS.update({ selected: 'surv' }));
    OWHotkeys.onHotkeyDown(kHotkeys.mode1v1switchToKllr, () => MODE_1V1_SETTINGS.update({ selected: 'kllr' }));
    OWHotkeys.onHotkeyDown(kHotkeys.mode1v1resetTimer, () => this.timerApi?.resetTimer());
    OWHotkeys.onHotkeyDown(kHotkeys.mode1v1resetTimers, () => this.timerApi?.resetTimers());
    OWHotkeys.onHotkeyDown(kHotkeys.mode1v1startStopTimer, () => this.timerApi?.startStop());

    overwolf.games.inputTracking.onKeyDown.addListener(e => {
      if (e.key === '50') this.timerApi?.handleEmote();
      if (e.key === '162') this.timerApi?.handleCrouch();
    });
    overwolf.games.inputTracking.onMouseDown.addListener(e => {
      this.timerApi?.[e.button === 'left' ? 'handleM1' : 'handleM2']();
    })
  }

  public beforeClose(): void | Promise<void> {
    this.unsubscribeListener?.();
  }
}

Mode1v1.instance();

const Mode1v1App = () => {
  const theme = useMode1v1Theme();
  const hotkeys = useHotkeys();

  const inMatch = useGameState(s => s.state.type === GameStateType.MATCH);
  const startKillerType = useGameState(s => s.state.killer?.start?.m2 ? 'M2' : 'M1');
  const startKillerText = useGameState(s => s.state.killer?.start?.label);

  const startOnCrouch = MODE_1V1_SETTINGS.hook(s => s.startSurvOnCrouch);
  const startOnSwing = MODE_1V1_SETTINGS.hook(s => s.startKllrOnSwing);
  const stopOnEmote = MODE_1V1_SETTINGS.hook(s => s.stopOnEmote);
  const showHotkeys = MODE_1V1_SETTINGS.hook(s => s.showHotkeys);
  const showMs = MODE_1V1_SETTINGS.hook(s => s.showMs);

  const apiRef = useRef<Mode1v1TimerRef>(null);

  const challenge = useCurrent1v1Challenge();

  const game = challenge?.played[challenge.played.length - 1];
  useEffect(() => { !game && Mode1v1Manager.Instance().addGame(challenge) }, [game]);

  const survTime = game?.survTime ?? 0;
  const kllrTime = game?.kllrTime ?? 0;
  const survPoints = challenge?.played.filter(g => !!g.kllrTime && !!g.survTime).filter(g => g.survTime < g.kllrTime).length ?? 0;
  const kllrPoints = challenge?.played.filter(g => !!g.kllrTime && !!g.survTime).filter(g => g.survTime > g.kllrTime).length ?? 0;

  // whenever DB / external challenge changes, sync timer + "persisted" baseline
  const data = useMemo(() => ({
    survTime,
    kllrTime,
    survPoints,
    kllrPoints,
  }), [survTime, kllrTime, survPoints, kllrPoints]);

  return (
    <BaseWindow fullWindowDrag transparent>
      {game && <RenderMode1v1Timer
        key={'mode-1v1-timer-app'}
        data={data}
        ref={api => Mode1v1.instance().setTimerApi((apiRef.current = api))}
        theme={theme}
        hotkeys={hotkeys}
        inMatch={inMatch}
        startKillerType={startKillerType}
        startKillerText={startKillerText}
        startOnCrouch={startOnCrouch}
        startOnSwing={startOnSwing}
        stopOnEmote={stopOnEmote}
        showHotkeys={showHotkeys}
        showMs={showMs}
        bg="transparent"
        onState={state => {
          MODE_1V1_STATE.update({ state });

          const nextDataKey = stringify(state.res);

          // if the timer is just echoing what we already consider persisted, do nothing
          if (nextDataKey === stringify(data)) return;

          if (!state.running) {
            game.survTime = state.res.survTime;
            game.kllrTime = state.res.kllrTime;
            Mode1v1Manager.Instance().updateChallenge({ ...challenge });
          }
        }}
      />}
    </BaseWindow>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<Mode1v1App />);