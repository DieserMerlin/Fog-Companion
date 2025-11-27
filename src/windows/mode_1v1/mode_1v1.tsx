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
import { MODE_1V1_SETTINGS, useMode1v1Theme } from "./mode_1v1-settings";
import { Mode1v1ChallengeManager } from "../main/mode-1v1/mode-1v1-manager";
import { MODE_1V1_STATE } from "./use-mode-1v1-state";
import { useCurrent1v1Challenge } from "./use-current-1v1-challenge";
import { useEffect, useMemo, useRef } from "react";
import stringify from 'json-stringify-deterministic';


class Mode1v1 extends AppWindow {

  private static _instance: Mode1v1;

  private constructor() {
    super(kWindowNames.mode_1v1);

    this.setHotkeyBehavior();
    useMode1v1Theme.subscribe((curr, prev) => stringify(curr.theme) !== stringify(prev.theme) && this.resize());
    this.resize();
  }

  private timerApi: Mode1v1TimerRef;
  private unsubscribeListener: () => void;
  setTimerApi(api: Mode1v1TimerRef) {
    this.timerApi = api;
    if (!api) return;

    api.switchMode(MODE_1V1_SETTINGS.getValue().selected);

    this.unsubscribeListener?.();

    const unsubscribeHook = MODE_1V1_SETTINGS.hook.subscribe(s => api.switchMode(s.selected));

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
    const { theme } = useMode1v1Theme.getState();
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

  public beforeClose(): void | Promise<void> {
    this.unsubscribeListener?.();
  }
}

Mode1v1.instance();

const Mode1v1App = () => {
  const theme = useMode1v1Theme(s => s.theme);
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
  const stringifiedChallenge = stringify(challenge);

  // tracks the last "persisted" played state to avoid re-saving same data
  const lastPersistedPlayedRef = useRef<string | null>(null);

  // whenever DB / external challenge changes, sync timer + "persisted" baseline
  useEffect(() => {
    if (!stringifiedChallenge) return;
    const parsed = JSON.parse(stringifiedChallenge);

    // this is now considered the authoritative persisted state
    lastPersistedPlayedRef.current = stringify(parsed.played ?? null);

    apiRef.current?.setChallenge(parsed);
  }, [stringifiedChallenge]);

  return (
    <BaseWindow fullWindowDrag transparent>
      {challenge && <RenderMode1v1Timer
        key={'mode-1v1-timer-app'}
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

          const nextChallenge = state.challenge;
          if (!nextChallenge) return;

          const nextPlayedKey = stringify(nextChallenge.played ?? null);

          // if the timer is just echoing what we already consider persisted, do nothing
          if (nextPlayedKey === lastPersistedPlayedRef.current) return;

          if (!state.running) {
            // we're about to persist this; update the baseline first
            lastPersistedPlayedRef.current = nextPlayedKey;
            Mode1v1ChallengeManager.Instance().updateChallenge(nextChallenge);
          }
        }}
        onRequestChallenge={() => challenge}
      />}
    </BaseWindow>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<Mode1v1App />);