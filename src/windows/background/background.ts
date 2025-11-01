import {
  OWGameListener,
  OWHotkeys,
  OWWindow
} from '@overwolf/overwolf-api-ts';

import { PSM } from 'tesseract.js';
import { kHotkeys, kWindowNames } from '../../consts';
import { GameState, GameStateGuesser } from '../../game_state/GameState';
import { AnyScanArea, OcrAreasResult, performOcrAreas, performOcrAreasOnImage } from '../../utils/ocr/area-ocr';
import { createBus, TypedBus } from '../../utils/window/window-bus';
import { CALLOUT_SETTINGS } from '../callouts/callout-settings';
import { INGAME_SETTINGS } from '../main/in_game-settings';
import { AppMode, BACKGROUND_SETTINGS, BackgroundSettings } from './background-settings';

/* ============================================================================
 * App-wide event bus
 * ========================================================================== */

type AppEvents = {
  'game-state': GameState,
  'app-mode-switch': AppMode,
  'select-map': { realm: string, fileName: string },
  'game-info': overwolf.games.RunningGameInfo | null,
  'ocr-res': OcrAreasResult,
  'ocr-decision': string,
}

declare global {
  interface Window {
    bus: TypedBus<AppEvents>;
    cache: { [key: string]: any };
    gameInfo: overwolf.games.RunningGameInfo | null;
  }
}

// Shared bus for cross-window communication.
window.bus = createBus();

// Shared cache for various things.
window.cache = {};

/* ============================================================================
 * Constants & helpers
 * ========================================================================== */


/** Convenience debug wrapper that mirrors original return shape & logs. */
const makeReturn = (key: string, res: OcrAreasResult) => {
  const debug = { type: key, res: res[key as keyof OcrAreasResult] };
  window.bus.emit('ocr-decision', key);
  window.cache['ocr-decision'] = key;
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
    // Disable debug windows on app start
    BACKGROUND_SETTINGS.update({ enableOcrDebug: false, ocrDebugBreakOn: null });

    // Relay GameState guesses to the app bus.
    this.guesser.bus.on('gameState', gs => window.bus.emit('game-state', gs));

    // Begin periodic OCR (non-blocking).
    this.startOcr();

    // Apply initial background settings and register hotkeys.
    this.settingsUpdate(BACKGROUND_SETTINGS.getValue());
    this.registerHotkeys();

    let initialized = false;

    setInterval(() => {
      overwolf.games.getRunningGameInfo((res) => {
        window.bus.emit('game-info', res);
        window.gameInfo = res;

        if (!initialized) {
          initialized = true;
          this.applyStartupVisibility(res); // new helper below
        } else {
          this.fixMainWindow(!!res?.isRunning);
        }
      });
    }, 1000);

    this._gameListener = new OWGameListener({
      onGameStarted: async () => {
        // Scenario 2: if app is visible on desktop, switch to in-game;
        // otherwise respect openOnStartup.
        const desktopVisible = await this.isWindowVisible(this._windows.main_desktop);
        const shouldShow = desktopVisible || INGAME_SETTINGS.getValue().openOnStartup;
        this.toggleMainWindow(shouldShow);
        this.guesser.onGameOpened();
      },
      onGameEnded: async () => {
        window.bus.emit('game-info', null);
        // Scenario 1: always show desktop when the game exits
        this.toggleMainWindow(true);
        this.guesser.onGameClosed();
      },
    });
    this._gameListener.start();
  }

  /** Singleton accessor. */
  public static instance(): BackgroundController {
    if (!BackgroundController._instance) {
      BackgroundController._instance = new BackgroundController();
    }
    return BackgroundController._instance;
  }

  private applyStartupVisibility(gi: overwolf.games.RunningGameInfo | null) {
    const openOnStartup = INGAME_SETTINGS.getValue().openOnStartup;

    if (!gi?.isRunning) {
      // Scenario 1 on app boot w/ game closed: surface desktop window
      this.toggleMainWindow(true);
    } else if (openOnStartup) {
      // Game is already running: show according to in-game/desktop preference
      this.toggleMainWindow(true);
    } else {
      // Game running & openOnStartup is false → stay hidden until hotkey
      this.toggleMainWindow(false);
    }
  }

  private async isWindowVisible(win?: OWWindow | null) {
    if (!win) return false;
    const st = await win.getWindowState();
    return st?.window_state === 'normal' || st?.window_state === 'maximized';
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

    // Toggle between desktop/in-game window.
    INGAME_SETTINGS.hook.subscribe((state, prev) => prev.showInGame !== state.showInGame && this.toggleMainWindow(true));

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
   * Toggle the main window between show/hide and in-game/desktop.
   */
  private async toggleMainWindow(show?: boolean) {
    const inGame = INGAME_SETTINGS.getValue().showInGame && !!window.gameInfo?.isRunning;

    const usedWindowType = inGame ? 'main_in_game' : 'main_desktop';
    let usedWindow = this._windows[usedWindowType];

    // Compute default "toggle" behavior only if caller didn't pass a boolean
    if (typeof show !== 'boolean') {
      const state = await usedWindow?.getWindowState();
      show = !(state?.window_state === 'normal' || state?.window_state === 'maximized');
    }

    const otherWindowType = inGame ? 'main_desktop' : 'main_in_game';
    const otherWindow = this._windows[otherWindowType];

    if (!show) {
      // Don't instantiate a window just to minimize it
      await otherWindow?.close();
      await usedWindow?.minimize();
      return;
    }

    if (!usedWindow)
      usedWindow = this._windows[usedWindowType] = new OWWindow(usedWindowType);

    await otherWindow?.close();
    this._windows[otherWindowType] = null;

    await usedWindow.restore();
  }

  async fixMainWindow(running?: boolean) {
    if (!running) {
      // Game not running → ensure desktop is up (scenario 1)
      if (!this._windows.main_desktop) this.toggleMainWindow(true);
      return;
    }

    if (running && !this._windows.main_in_game) {
      const state = await this._windows.main_desktop?.getWindowState();
      const wasVisible = state?.window_state === 'normal' || state?.window_state === 'maximized';
      this.toggleMainWindow(wasVisible);
    }
  }

  private toggleWindow(window: kWindowNames, to?: boolean) {
    const show = to ?? !!this._windows[window];

    if (!show) {
      this._windows[window]?.close();
      this._windows[window] = null;
    } else {
      if (!this._windows[window]) this._windows[window] = new OWWindow(window);
      this._windows[window].restore();
    }
  }

  /**
   * Apply window visibility to match current background settings.
   * Identity with original: 1v1 and callouts get restored/closed.
   */
  private settingsUpdate(settings: BackgroundSettings) {
    this.toggleWindow(kWindowNames.mode_1v1, settings.mode === '1v1');
    this.toggleWindow(kWindowNames.callouts, settings.calloutOverlay);
    this.toggleWindow(kWindowNames.debug, settings.enableOcrDebug);
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
      if (lock || (Date.now() - last) < 1000) return;

      // Skip if disabled
      const settings = BACKGROUND_SETTINGS.getValue();
      if (!settings.enableSmartFeatures) return;

      // Debug breakpoint
      if (settings.enableOcrDebug && !!settings.ocrDebugBreakOn) {
        if (this.guesser.state.type === settings.ocrDebugBreakOn) return;
      }

      lock = true;

      try {
        const gi = await new Promise<overwolf.games.GetRunningGameInfoResult>((resolve) =>
          overwolf.games.getRunningGameInfo(resolve)
        );
        if (!gi || !gi.success || !gi.isRunning || !gi.isInFocus) return;

        const start = Date.now();

        // Build areas exactly as before (unchanged)
        const OCR_AREAS: AnyScanArea[] = [
          { id: 'map', type: 'ocr' as const, rect: { x: 0, y: 0.7, w: 0.6, h: 0.3 }, psm: PSM.SPARSE_TEXT, threshold: 240, canvas: window.cache.canvas?.['map'] || undefined },
          { id: 'main-menu', type: 'ocr' as const, rect: { x: 0, y: 0.0, w: 0.5, h: 0.6 }, psm: PSM.SINGLE_COLUMN, threshold: 120, canvas: window.cache.canvas?.['main-menu'] || undefined },
          { id: 'menu-btn', type: 'ocr' as const, rect: { x: 0.7, y: 0.7, w: 0.3, h: 0.3 }, psm: PSM.SPARSE_TEXT, threshold: 120, canvas: window.cache.canvas?.['menu-btn'] || undefined },
          { id: 'bloodpoints', type: 'ocr' as const, rect: { x: 0.65, y: 0, w: 0.35, h: 0.15 }, psm: PSM.SINGLE_LINE, canvas: window.cache.canvas?.['bloodpoints'] || undefined },
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
            minMatchRatio: 0.9
          },
          { id: 'loading-text', type: 'ocr' as const, rect: { x: 0.3, y: 0.3, w: 0.4, h: 0.2 }, psm: PSM.SPARSE_TEXT, canvas: window.cache.canvas?.['loading-text'] || undefined },
          { id: 'settings', type: 'ocr' as const, rect: { x: 0, y: 0, w: 1, h: 0.3 }, psm: PSM.SPARSE_TEXT, threshold: 120, canvas: window.cache.canvas?.['settings'] || undefined },
        ] as const;

        // 1) Capture one screenshot and reuse it for all stages
        const img = await (async () => {
          // reuse helper from area-ocr.ts via a tiny indirection
          const mod = await import("../../utils/ocr/area-ocr");
          // not exported, so call performOcrAreas([]) to force capture? We expose a helper instead:
          // we added performOcrAreasOnImage(img, areas), so capture here with a private helper:
          const _imgGetter = (mod as any).__captureScreenshotImage || (mod as any).captureScreenshotImage || null;
          if (_imgGetter) return await _imgGetter();
          // Fallback — call performOcrAreas to force capture; if null return
          return null;
        })();

        if (!img) {
          // Hard fallback to old path
          const res = await performOcrAreas(OCR_AREAS as any);
          window.bus.emit('ocr-res', res);
          await this.evaluateRes(res!);
          console.log("SCREENSHOT PROCESSING TOOK " + (Date.now() - start));
          return;
        }

        // We’ll accumulate on the same result map
        const res: OcrAreasResult = Object.create(null);

        // Helper to run a subset against the captured image, publish, and try early-exit
        const runSubset = async (subset: AnyScanArea[]) => {
          const sub = await performOcrAreasOnImage(img, subset);
          Object.assign(res, sub);
          // alias preserved for evaluateRes
          (res as any)['settings-back-btn'] = res['map'];
          window.bus.emit('ocr-res', res);
          const match = await this.evaluateRes(res as OcrAreasResult);
          return !!match;
        };

        // Stage A: loading-screen first (cheap, can return early while keeping your check order)
        if (await runSubset(OCR_AREAS.filter(a => (a as any).type === 'pure-black'))) {
          console.log("SCREENSHOT PROCESSING TOOK " + (Date.now() - start));
          return;
        }

        // Stage B: top-priority OCR — map, then settings
        if (await runSubset(OCR_AREAS.filter(a => a.id === 'map'))) {
          console.log("SCREENSHOT PROCESSING TOOK " + (Date.now() - start));
          return;
        }
        if (await runSubset(OCR_AREAS.filter(a => a.id === 'settings'))) {
          console.log("SCREENSHOT PROCESSING TOOK " + (Date.now() - start));
          return;
        }

        // Stage C: the rest in one go (concurrent via scheduler)
        await runSubset(OCR_AREAS.filter(a => a.id !== 'map' && a.id !== 'settings' && (a as any).type !== 'pure-black'));

        console.log("SCREENSHOT PROCESSING TOOK " + (Date.now() - start));
      } catch {
        // swallow
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

    // 1) Map
    if (res['map']?.type === 'ocr') {
      const mapRes = res['map'] as Extract<NonNullable<typeof res['map']>, { type: 'ocr' }>;
      if (mapRes.text.map(guess => this.guesser.guessMap(guess)).some(Boolean)) {
        return makeReturn('map', res);
      }
      if (this.guesser.guessKiller(mapRes)) {
        return makeReturn('killer', res);
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

    this.guesser.assumeInMatch();

    return null;
  }
}

/* ============================================================================
 * Boot
 * ========================================================================== */

BackgroundController.instance();
