import {
  OWGameListener,
  OWHotkeys,
  OWWindow
} from '@overwolf/overwolf-api-ts';

import { PSM } from 'tesseract.js';
import { kHotkeys, kWindowNames } from '../../consts';
import { GameState, GameStateGuesser } from '../../game_state/GameState';
import { OcrAreasResult, performOcrAreas } from '../../utils/ocr/area-ocr';
import { createBus, TypedBus } from '../../utils/window/window-bus';
import { CALLOUT_SETTINGS } from '../callouts/callout-settings';
import { INGAME_SETTINGS } from '../in_game/in_game-settings';
import { AppMode, BACKGROUND_SETTINGS, BackgroundSettings } from './background-settings';

/* ============================================================================
 * App-wide event bus
 * ========================================================================== */

type AppEvents = {
  'game-state': GameState,
  'app-mode-switch': AppMode,
  'select-map': { realm: string, fileName: string },
  'game-info': overwolf.games.RunningGameInfo | null,
}

declare global {
  interface Window {
    bus: TypedBus<AppEvents>;
    cache: { [key: string]: any };
  }
}

// Shared bus for cross-window communication.
window.bus = createBus();

// Shared cache for various things.
window.cache = {};

/* ============================================================================
 * Constants & helpers
 * ========================================================================== */

/**
 * OCR areas we sample repeatedly to “guess” the current DBD game context.
 * NOTE: These are kept identical to the original logic.
 */
const OCR_AREAS = [
  { id: 'map', type: 'ocr' as const, rect: { x: 0, y: 0.7, w: 0.5, h: 0.3 }, psm: PSM.SPARSE_TEXT },
  { id: 'main-menu', type: 'ocr' as const, rect: { x: 0.05, y: 0.05, w: 0.3, h: 0.4 }, psm: PSM.SPARSE_TEXT },
  { id: 'menu-btn', type: 'ocr' as const, rect: { x: 0.8, y: 0.85, w: 0.2, h: 0.15 }, psm: PSM.SPARSE_TEXT },
  { id: 'bloodpoints', type: 'ocr' as const, rect: { x: 0.7, y: 0, w: 0.3, h: 0.15 }, psm: PSM.SPARSE_TEXT },
  {
    id: 'loading-screen',
    type: 'pure-black' as const,
    rects: [
      { x: 0, y: 0, w: 1, h: 0.02 },
      { x: 0, y: 0.98, w: 1, h: 0.02 },
      { x: 0, y: 0.02, w: 0.02, h: 0.96 },
      { x: 0.98, y: 0.02, w: 0.02, h: 0.96 }
    ],
    blackMax: 10,
    colorDeltaMax: 3,
    minMatchRatio: 0.97
  },
  { id: 'loading-text', type: 'ocr' as const, rect: { x: 0.25, y: 0.3, w: 0.5, h: 0.4 }, psm: PSM.SPARSE_TEXT },
  { id: 'settings', type: 'ocr' as const, rect: { x: 0, y: 0, w: 1, h: 0.2 }, psm: PSM.SPARSE_TEXT },
] as const;

/** Convenience debug wrapper that mirrors original return shape & logs. */
const makeReturn = (key: string, res: OcrAreasResult) => {
  const debug = { type: key, res: res[key as keyof OcrAreasResult] };
  console.log(debug);
  return debug;
};

/* ============================================================================
 * BackgroundController
 *  - Single entry point coordinating windows, hotkeys, OCR, and game hooks
 * ========================================================================== */

class BackgroundController {
  private static _instance: BackgroundController;

  /** Overwolf Game Listener lifecycle handler. */
  private _gameListener: OWGameListener;

  /** Quickly address windows by their logical names. */
  private _windows: Record<kWindowNames, OWWindow> = {} as any;

  /** Heuristic “guesser” knows how to interpret OCR for DBD state. */
  private guesser = new GameStateGuesser();

  /** Internal OCR pump interval handle. */
  private _ocrInterval!: NodeJS.Timeout;

  /* ------------------------------------------------------------------------
   * Construction & singleton access
   * --------------------------------------------------------------------- */

  private constructor() {
    // Prepare all windows eagerly so we can manipulate them fast.
    for (const windowName of Object.values(kWindowNames)) {
      this._windows[windowName] = new OWWindow(windowName);
    }

    // Relay GameState guesses to the app bus.
    this.guesser.bus.on('gameState', gs => window.bus.emit('game-state', gs));

    // Begin periodic OCR (non-blocking).
    this.startOcr();

    // Optionally show the in-game window when the app boots.
    if (INGAME_SETTINGS.getValue().openOnStartup) {
      this._windows.in_game.restore();
    }

    // Apply initial background settings and register hotkeys.
    this.settingsUpdate(BACKGROUND_SETTINGS.getValue());
    this.registerHotkeys();

    // Broadcast current running game info every second (unchanged cadence).
    setInterval(() => {
      overwolf.games.getRunningGameInfo(res => window.bus.emit('game-info', res));
    }, 1000);

    // Wire game start/stop lifecycle.
    this._gameListener = new OWGameListener({
      onGameStarted: () => {
        if (INGAME_SETTINGS.getValue().openOnStartup) {
          this._windows.in_game.restore();
        }
      },
      onGameEnded: () => {
        window.bus.emit('game-info', null);
        overwolf.windows.getMainWindow().close();
      },
    });

    this._gameListener.start();
    this._windows.debug.restore();
  }

  /** Singleton accessor. */
  public static instance(): BackgroundController {
    if (!BackgroundController._instance) {
      BackgroundController._instance = new BackgroundController();
    }
    return BackgroundController._instance;
  }

  /* ------------------------------------------------------------------------
   * Hotkeys & window toggles
   * --------------------------------------------------------------------- */

  /**
   * Register app-wide hotkeys.
   * Keeps the exact reactions and side-effects from the original code.
   */
  private registerHotkeys() {
    // Apply live settings updates from background settings store.
    BACKGROUND_SETTINGS.hook.subscribe((state) => this.settingsUpdate(state));

    // Toggle app modes; same ternary flip logic as before.
    const toggleMode = (mode: AppMode) =>
      BACKGROUND_SETTINGS.update({
        mode: (BACKGROUND_SETTINGS.getValue().mode === mode ? null : mode)
      });

    OWHotkeys.onHotkeyDown(kHotkeys.toggleMode1v1, () => toggleMode('1v1'));
    OWHotkeys.onHotkeyDown(kHotkeys.toggleModeScrim, () => toggleMode('scrim'));
    OWHotkeys.onHotkeyDown(kHotkeys.toggleMainWindow, () => this.toggleMainWindow());

    // Map overlay toggle (also forces callouts browser off as before).
    OWHotkeys.onHotkeyDown(kHotkeys.toggleMapWindow, () => {
      const current = BACKGROUND_SETTINGS.getValue().calloutOverlay;
      CALLOUT_SETTINGS.update({ browser: false });
      BACKGROUND_SETTINGS.update({ calloutOverlay: !current });
    });
  }

  /**
   * Toggle the in-game window between minimized and restored.
   * Behavior preserved exactly.
   */
  private async toggleMainWindow() {
    const inGameState = await this._windows.in_game.getWindowState();

    if (inGameState.window_state === 'normal' || inGameState.window_state === 'maximized') {
      this._windows.in_game.minimize();
    } else {
      this._windows.in_game.restore();
    }
  }

  /**
   * Apply window visibility to match current background settings.
   * Identity with original: 1v1 and callouts get restored/minimized.
   */
  private settingsUpdate(settings: BackgroundSettings) {
    this._windows.mode_1v1[settings.mode === '1v1' ? 'restore' : 'minimize']();
    this._windows.callouts[settings.calloutOverlay ? 'restore' : 'minimize']();
  }

  /* ------------------------------------------------------------------------
   * OCR sampling loop
   * --------------------------------------------------------------------- */

  /**
   * Start a periodic OCR sweep that reads specific screen regions and
   * attempts to infer which DBD state we’re currently in (menu/loading/match).
   *
   * NOTE: The interval, gating logic, and internal variables (including
   * `lock` / `last`) are intentionally kept the same for behavior parity.
   */
  private startOcr() {
    if (this._ocrInterval) return;

    let lock = false;
    let last = 0;

    this._ocrInterval = setInterval(async () => {
      // Keep the original throttling and gating as-is.
      if (lock || (Date.now() - last) < 1000) return;
      lock = true;

      try {
        const res = await performOcrAreas(OCR_AREAS as any);
        await this.evaluateRes(res);
      } catch (e) {
        // Shut
      } finally {
        last = Date.now();
        lock = false;
      }
    }, 50);
  }

  /* ------------------------------------------------------------------------
   * OCR evaluation: ordered, short-circuit checks
   * --------------------------------------------------------------------- */

  /**
   * Evaluate an OCR snapshot to determine game state, in a strict priority
   * order. This preserves the exact checking sequence and conditions from the
   * original implementation, including the aliasing of `settings-back-btn`.
   *
   * Returns the same debug object (or null) as before and logs to console.
   */
  private async evaluateRes(res: OcrAreasResult) {
    // Alias preserved
    (res as any)['settings-back-btn'] = res['map'];

    console.log(res['map']);

    // 1) Map
    if (res['map']?.type === 'ocr') {
      const mapRes = res['map'] as Extract<NonNullable<typeof res['map']>, { type: 'ocr' }>;
      if ((await Promise.all(mapRes.text.map(async guess => await this.guesser.guessMap(guess)))).some(Boolean)) {
        return makeReturn('map', res);
      }
    }

    // 2) Settings (right)
    if (res['settings']?.type === 'ocr') {
      const s = res['settings'] as Extract<NonNullable<typeof res['settings']>, { type: 'ocr' }>;
      if (this.guesser.guessSettings('right', s)) {
        return makeReturn('settings', res);
      }
    }

    // 3) Loading screen (pure-black)
    if (res['loading-screen']?.type === 'pure-black') {
      const ls = res['loading-screen'] as Extract<NonNullable<typeof res['loading-screen']>, { type: 'pure-black' }>;
      if (this.guesser.guessLoadingScreen(ls)) {
        return makeReturn('loading-screen', res);
      }
    }

    // 4) Loading text
    if (res['loading-text']?.type === 'ocr') {
      const lt = res['loading-text'] as Extract<NonNullable<typeof res['loading-text']>, { type: 'ocr' }>;
      if (this.guesser.guessLoadingScreen(undefined, lt)) {
        return makeReturn('loading-text', res);
      }
    }

    // 5) Main menu
    if (res['main-menu']?.type === 'ocr') {
      const mm = res['main-menu'] as Extract<NonNullable<typeof res['main-menu']>, { type: 'ocr' }>;
      if (this.guesser.guessMenu('main-menu', mm)) {
        return makeReturn('main-menu', res);
      }
    }

    // 6) Menu button
    if (res['menu-btn']?.type === 'ocr') {
      const mb = res['menu-btn'] as Extract<NonNullable<typeof res['menu-btn']>, { type: 'ocr' }>;
      if (this.guesser.guessMenu('menu-btn', mb)) {
        return makeReturn('menu-btn', res);
      }
    }

    // 7) Bloodpoints
    if (res['bloodpoints']?.type === 'ocr') {
      const bp = res['bloodpoints'] as Extract<NonNullable<typeof res['bloodpoints']>, { type: 'ocr' }>;
      if (this.guesser.guessMenu('bloodpoints', bp)) {
        return makeReturn('bloodpoints', res);
      }
    }

    // 8) Settings back button (alias)
    if ((res as any)['settings-back-btn']?.type === 'ocr') {
      const sb = (res as any)['settings-back-btn'] as Extract<NonNullable<typeof res['map']>, { type: 'ocr' }>;
      if (this.guesser.guessSettings('left', sb)) {
        return makeReturn('settings-back-btn', res);
      }
    }

    return null;
  }
}

/* ============================================================================
 * Boot
 * ========================================================================== */

BackgroundController.instance();
