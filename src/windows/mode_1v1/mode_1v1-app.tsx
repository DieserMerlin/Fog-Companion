import { Lock } from '@mui/icons-material';
import { useEffect, useMemo, useRef } from 'react';
import { create } from 'zustand';
import { GameStateType } from '../../game_state/GameState';
import { useGameState } from '../../utils/hooks/gamestate-hook';
import { useHotkeys } from '../../utils/hooks/hotkey-hook';
import { theme } from '../../utils/mui/theme';
import { MODE_1V1_SETTINGS } from './mode_1v1-settings';

type TimerType = 'survivor' | 'killer';

function formatTime(ms: number, showMilliseconds: boolean): string {
  // Clamp to 99:59:99 (≈ 6,000,000 ms)
  if (ms > 5_999_990) ms = 5_999_990;

  const totalSeconds = (ms / 1000) | 0; // integer division
  const minutes = (totalSeconds / 60) | 0;
  const seconds = totalSeconds - minutes * 60;
  const hundredths = ((ms - totalSeconds * 1000) / 10) | 0;

  const mm = minutes < 10 ? "0" + minutes : "" + minutes;
  const ss = seconds < 10 ? "0" + seconds : "" + seconds;

  if (!showMilliseconds) {
    return mm + ":" + ss;
  }

  const hh = hundredths < 10 ? "0" + hundredths : "" + hundredths;
  return mm + ":" + ss + ":" + hh;
}

export type Mode1v1TimerAPI = ReturnType<typeof useMode1v1TimerAPI>;

export const useMode1v1TimerAPI = () => {
  const settings = MODE_1V1_SETTINGS.hook();
  const inMatch = useGameState(s => s.state.type === GameStateType.MATCH);

  const timerRefs = useRef<{ [type in TimerType]: { value: number, span: HTMLSpanElement | null } }>({ survivor: { value: 0, span: null }, killer: { value: 0, span: null } });
  const intervalRef = useRef<NodeJS.Timeout>(null);

  const useLiveUpdate = useMemo(() => create<{ isRunning: boolean, refs: typeof timerRefs.current, lastUpdate: number }>(() => ({ isRunning: false, refs: timerRefs.current, lastUpdate: Date.now() })), []);

  const setLiveUpdateState = () => useLiveUpdate.setState({ isRunning: !!intervalRef.current, lastUpdate: Date.now() });

  const updateSpans = () => {
    for (const type of Object.keys(timerRefs.current) as TimerType[]) {
      const ref = timerRefs.current[type];
      if (ref.span) ref.span.innerText = formatTime(ref.value, settings.showMs);
    }
  }

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setLiveUpdateState();

  }

  const gameStateType = useGameState(s => s.state?.type);

  useEffect(() => stop(), [settings.selected]);
  useEffect(() => { (gameStateType === GameStateType.MENU) && stop() }, [gameStateType]);

  const start = () => {
    stop();
    let type = settings.selected;
    let startTime = Date.now();
    let startValue = timerRefs.current[type].value;

    intervalRef.current = setInterval(() => {
      const element = timerRefs.current[type];
      element.value = startValue + (Date.now() - startTime);
      updateSpans();
    }, 16)

    setLiveUpdateState();
  }

  return {
    onCrouch: () => {
      if (
        settings.selected === 'survivor' &&
        timerRefs.current.survivor.value === 0 &&
        inMatch &&
        settings.startSurvOnCrouch
      ) start();
    },
    onEmote: () => {
      if (settings.stopOnEmote) stop();
    },
    onSwing: (type: 'm1' | 'm2') => {
      const killer = useGameState.getState().state.killer;

      if (type === 'm1' && !!killer && !killer?.start?.m1) return;
      if (type === 'm2' && (!killer?.start?.m2)) return;

      if (
        settings.selected === 'killer' &&
        timerRefs.current.killer.value === 0 &&
        inMatch &&
        settings.startKllrOnSwing
      ) start();
    },
    onStartStop: () => intervalRef.current === null ? start() : stop(),
    onReset: () => {
      stop();
      timerRefs.current[settings.selected].value = 0;
      updateSpans();
      setLiveUpdateState();
    },
    onResetBoth: () => {
      stop();
      Object.values(timerRefs.current).forEach(ref => ref.value = 0);
      updateSpans();
      setLiveUpdateState();
    },
    isRunning: () => intervalRef.current !== null,
    setRef: (type: TimerType, element: HTMLSpanElement | null) => { timerRefs.current[type].span = element; },
    useLiveUpdate,
  }
};

const Render1v1Timer = (props: {
  type: 'survivor' | 'killer',
  ref: (element: HTMLSpanElement) => void,
}) => {
  return (
    <>
      <div className='timer_text'><span>{props.type.toUpperCase()}</span></div>
      <div className='timer_time'><span ref={props.ref}>{'00:00:00'}</span></div>
    </>
  );
};

export const DEFAULT_1V1_TIMER_STYLES = `
#mode_1v1_overlay {
  position: absolute;
  z-index: 9999;
  width: 100vw;
  height: 100vh;
  left: 0;
  top: 0;
  overflow: hidden;

  /* Center the entire overlay */
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

#mode_1v1_container {
  width: 600px;
  height: 150px;

  display: grid;
  grid-template-columns: 18% 32% 32% 18%;
  gap: 4px;

  align-items: stretch;
  justify-items: stretch;
}

/* Column containers (hotkeys and timers) */
#mode_1v1_container > .timer_hotkeys,
#mode_1v1_surv_container,
#mode_1v1_kllr_container {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 4px;
}

/* Zero-width separator, if used */
#mode_1v1_timer_separator {
  width: 0;
}

/* Hotkey pill styling */
.timer_hotkey {
  display: flex;
  font-size: 0.65em;
  background-color: ${theme.palette.background.default};
  padding: 2px 7px;
}
.timer_hotkey.locked {
  background-color: ${theme.palette.error.dark};
}
.timer_hotkey_text {
  flex-grow: 1;
}
.timer_hotkey_binding {
  font-weight: bold;
}

/* Timer block styling */
.timer_text,
.timer_time {
  flex: 1 1 auto;
  width: 100%;
  background-color: ${theme.palette.background.default};
  display: flex;
  align-items: center;
  justify-content: center;
}

.timer_text span,
.timer_time span {
  display: inline-block;
  line-height: 1;
}

.timer_text {
  font-size: 1.8em;
  max-height: 60px;
}

.selected .timer_text {
  font-weight: bold;
}

.timer_time {
  font-variant-numeric: tabular-nums;
  max-height: 40px;
}
`;

export const Render1v1Overlay = (props: { onApi: (api: Mode1v1TimerAPI) => void, customCss?: string }) => {
  const {
    customCss,
    selected,
    showHotkeys,
    showMs,
    startKllrOnSwing,
    startSurvOnCrouch,
    stopOnEmote
  } = MODE_1V1_SETTINGS.hook();

  const {
    mode_1v1_reset_timer,
    mode_1v1_reset_timers,
    mode_1v1_switch_kllr,
    mode_1v1_switch_surv,
    mode_1v1_start_stop_timer
  } = useHotkeys();

  const inMatch = useGameState(s => s.state.type === GameStateType.MATCH);

  const api = useMode1v1TimerAPI();
  useEffect(() => props.onApi(api), [api]);

  const { isRunning, refs, lastUpdate } = api.useLiveUpdate();
  const killer = useGameState(s => s.state.killer);

  const hotkeyElement = useMemo(() => {
    if (!showHotkeys) return null;

    const out: { name: string; hotkey: string, locked?: boolean }[] = [];

    if (selected === 'survivor') {
      out.push({ name: 'Switch', hotkey: mode_1v1_switch_kllr });
      if (!isRunning && startSurvOnCrouch) out.push({ name: 'Start', hotkey: 'Crouch', locked: !inMatch || !!refs.survivor.value });
    }
    if (selected === 'killer') {
      out.push({ name: 'Switch', hotkey: mode_1v1_switch_surv });
      if (!isRunning && startKllrOnSwing) out.push({ name: 'Start', hotkey: killer?.start?.label || 'M1', locked: !inMatch || !!refs.killer.value });
    }

    if (isRunning && stopOnEmote) out.push({ name: 'Stop', hotkey: 'Emote (2)' });
    out.push({ name: 'Start/Stop', hotkey: mode_1v1_start_stop_timer });
    out.push({ name: 'Reset', hotkey: mode_1v1_reset_timer });

    return out.map(hk => (
      <div className={'timer_hotkey' + (hk.locked ? ' locked' : '')}>
        <div className='timer_hotkey_text'>{hk.name}</div>
        <div className='timer_hotkey_binding'>{hk.hotkey}{hk.locked ? <Lock style={{ fontSize: 'inherit' }} /> : null}</div>
      </div>
    ));
  }, [killer, lastUpdate, inMatch, selected, showHotkeys, startKllrOnSwing, startSurvOnCrouch, mode_1v1_switch_kllr, mode_1v1_switch_surv, mode_1v1_start_stop_timer, mode_1v1_reset_timer]);

  return (
    <>
      <style>{DEFAULT_1V1_TIMER_STYLES}</style>
      <style>{props.customCss || customCss || ''}</style>
      <div id="mode_1v1_overlay">
        <div id="mode_1v1_container">
          {/* Left hotkeys column */}
          <div className="timer_hotkeys">
            {selected === 'survivor' ? hotkeyElement : null}
          </div>

          {/* Survivor timer */}
          <div id="mode_1v1_surv_container" className={selected === 'survivor' ? 'selected' : ''}>
            <Render1v1Timer type="survivor" ref={e => api.setRef('survivor', e)} />
          </div>

          {/* Killer timer */}
          <div id="mode_1v1_kllr_container" className={selected === 'killer' ? 'selected' : ''}>
            <Render1v1Timer type="killer" ref={e => api.setRef('killer', e)} />
          </div>

          {/* Right hotkeys column */}
          <div className="timer_hotkeys">
            {selected === 'killer' ? hotkeyElement : null}
          </div>
        </div>
      </div>
    </>
  );
};
