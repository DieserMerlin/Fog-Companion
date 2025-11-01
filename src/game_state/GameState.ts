import { distance } from "fastest-levenshtein";
import { MapDirectory } from "../generated-map-directory";
import { GameStateMap, MapResolver } from "../map_resolver/MapResolver";
import { OCRSingleResult, PureBlackResult } from "../utils/ocr/area-ocr";
import { createBus } from "../utils/window/window-bus";
import { BACKGROUND_SETTINGS } from "../windows/background/background-settings";

// ===== Shared Types =====

export enum GameStateType {
  MENU = 'MENU',
  MATCH = 'MATCH',
  LOADING = 'LOADING',
  UNKNOWN = 'UNKNOWN',
  CLOSED = 'CLOSED',
}

export enum DetectionCause {
  MAIN_MENU_TEXT = 'MAIN_MENU_TEXT',
  MENU_BUTTON_TEXT = 'MENU_BUTTON_TEXT',
  BLOODPOINTS_TEXT = 'BLOODPOINTS_TEXT',
  LOADING_TEXT = 'LOADING_TEXT',
  BLACK_EDGES = 'BLACK_EDGES',
  MAP_TEXT = 'MAP_TEXT',
  SETTINGS_TEXT = 'SETTINGS_TEXT',
  KILLER_POWER_TEXT = 'KILLER_POWER_TEXT',
  FALLBACK = 'FALLBACK',
}

export type DetectableKiller = {
  name: string;
  start: { m1?: true, m2?: true, label?: string };
  detect: {
    powerIngameText?: string[]
  }
}

export const DetectableKillers: DetectableKiller[] = [
  //  { name: 'WRAITH', start: { m1: true, label: 'M1' }, detect: { powerIngameText: ['CLOAK', 'UNCLOAK'] } }, // useless rn
  { name: 'BLIGHT', start: { m2: true, label: "RUSH (M2)" }, detect: { powerIngameText: ['RUSH'] } },
  { name: 'NURSE', start: { m2: true, label: "BLINK (M2)" }, detect: { powerIngameText: ['BLINK'] } },
]

export type GameState = {
  type: GameStateType;
  map?: GameStateMap;
  killer?: DetectableKiller;
  detectedBy?: DetectionCause;
};

const isEqual = (a: any, b: any) => a === b;

// ===== GameStateGuesser (mostly unchanged; now delegates to MapResolver) =====

export class GameStateGuesser {

  public readonly bus = createBus<{ gameState: GameState }>();

  constructor() {
    MapResolver.Instance().init().catch(() => { });
    BACKGROUND_SETTINGS.hook.subscribe(() => {
      this.push({ ...this.state });
    });
    overwolf.windows.getMainWindow().bus.on('game-info', (gi) => {
      const running = !!gi?.isRunning;
      if (running && this._state.type === GameStateType.CLOSED) this.onGameOpened();
      if (!running) this.onGameClosed();
    });
  }

  private _state: GameState = { type: GameStateType.UNKNOWN };

  public get state() {
    return this._state;
  }

  publishGameStateChange(prev: GameState, next: GameState) {
    if (!isEqual(prev, next)) {
      this.bus.emit('gameState', next);
    }
  }

  private lastUpdate = Date.now();
  push(next: GameState) {
    const settings = BACKGROUND_SETTINGS.getValue();
    if (!settings.enableKillerDetection) delete next.killer;
    if (!settings.enableMapDetection) delete next.map;
    if (!settings.enableSmartFeatures) next = { type: GameStateType.UNKNOWN };

    const prev = this._state;
    if (isEqual(prev, next)) return;
    if (prev.type !== GameStateType.MATCH) next.map = prev.map;

    this._state = next;
    this.publishGameStateChange(prev, next);
    this.lastUpdate = Date.now();
  }

  escapeRe(s: string) {
    return s.replace(/[()|[\]\\\/]/g, "");
  }

  /**
   * Normalizes the result string[] for word-based matching.
   * Result is lowercased and split to single words.
   * @param array 
   * @returns 
   */
  normalizeStringArray(array: string[]) {
    return array
      .map(text => text.toLowerCase().split(" ").filter(Boolean))
      .flat()
  }

  /**
   * If settings are detected, keep current state and stop propagation.
   * @param type 
   * @param res 
   * @returns 
   */
  guessSettings(type: 'left' | 'right', res: { text: string[] }) {
    if (this.state.type === GameStateType.UNKNOWN) return;
    const leftKeywords = ["back", "esc", "apply", "changes"];

    const result = type === 'left'
      ? this.normalizeStringArray(res.text)
        .some(t => leftKeywords.some(k => this.escapeRe(t) === k))
      : this.normalizeStringArray(res.text)
        .filter(t => [
          "general", "accessibility", "beta", "online", "graphics",
          "audio", "controls", "input", "binding", "support", "match", "details"
        ].includes(t))
        .length >= 5;

    if (result) this.push({ detectedBy: DetectionCause.SETTINGS_TEXT, ...this._state });
    return result;
  }

  /**
   * Detect loading screen by black borders or loading screen text.
   * @param blackRes 
   * @param textRes 
   * @returns 
   */
  guessLoadingScreen(blackRes?: PureBlackResult, textRes?: OCRSingleResult) {
    if (this.state.type === GameStateType.UNKNOWN) return;
    if (this.state.type === GameStateType.MATCH) return;

    let result: DetectionCause;
    if (blackRes?.passed) result = DetectionCause.BLACK_EDGES;

    if (textRes) {
      if (textRes.text.some(text => this.calculateTextMatch("connecting to other players", text) >= 0.9)) result = DetectionCause.LOADING_TEXT;
    }

    if (result) this.push({ type: GameStateType.LOADING, detectedBy: result });
    return result;
  }

  /**
   * Guess menu by buttons or bloodpoints.
   * @param type 
   * @param res 
   * @returns 
   */
  guessMenu(type: 'main-menu' | 'bloodpoints' | 'menu-btn', res: OCRSingleResult) {
    const getResult = () => {
      if (type === 'main-menu')
        return (this.normalizeStringArray(res.text).filter(line => ["play", "rift", "pass", "quests", "store"].some(keyword => line === keyword)).length >= 3) && DetectionCause.MAIN_MENU_TEXT;
      else if (type === 'menu-btn' && this._state.type !== GameStateType.UNKNOWN) // Edge case: "play" in game-start disclaimer text.
        return (this.normalizeStringArray(res.text).some(text => ["play", "continue", "cancel"].includes(text))) && DetectionCause.MENU_BUTTON_TEXT;
      else if (type === 'bloodpoints')
        return (this.normalizeStringArray(res.text).filter(text => text.match(/\d{3,}/g)).length >= 3) && DetectionCause.BLOODPOINTS_TEXT;
    }
    const result = getResult();
    if (result) this.push({ type: GameStateType.MENU, detectedBy: result });
    return result;
  }

  private _lastGuessedMap: { time: number, mapFile: string, match: number } | undefined;

  /**
   * Guess map based on highest text match of existing maps.
   * @param guessedName 
   * @returns 
   */
  guessMap(guessedName: string): GameStateMap | null {
    if (!BACKGROUND_SETTINGS.getValue().enableMapDetection) return null;

    const matches = Object.keys(MapDirectory)
      .flatMap(realm =>
        (MapDirectory as any)[realm].map((mapFile: string) => ({
          realm,
          mapFile,
          match: this.calculateTextMatch(mapFile, guessedName),
        }))
      )
      .sort((a, b) => b.match - a.match);

    console.log({ guessedName, matches });

    const [highestMatch] = matches;
    if (!highestMatch || highestMatch.match < .85) return null;

    console.log({ highestMatch });

    if (this._lastGuessedMap && (Date.now() - this._lastGuessedMap.time) > 3000 && highestMatch.match < this._lastGuessedMap.match) return null;
    this._lastGuessedMap = { time: Date.now(), ...highestMatch };

    const result = MapResolver.Instance().makeMapByName(highestMatch.mapFile);

    if (result) {
      this.push({ type: GameStateType.MATCH, map: result, detectedBy: DetectionCause.MAP_TEXT });
    }

    return result;
  }

  /**
   * Guess the current killer by their powers label.
   * @param res 
   * @returns 
   */
  guessKiller(res: OCRSingleResult) {
    if (!BACKGROUND_SETTINGS.getValue().enableKillerDetection) return null;

    if (this.state.type === GameStateType.UNKNOWN) return;
    if (this.state.type !== GameStateType.MATCH) return;

    const texts = this.normalizeStringArray(res.text);
    for (const killer of DetectableKillers) {
      if (!killer.detect.powerIngameText) return;
      const detectTexts = killer.detect.powerIngameText.map(t => t.toLowerCase());

      if (detectTexts.some(dt => texts.includes(dt))) {
        this.push({ ...this.state, killer, detectedBy: DetectionCause.KILLER_POWER_TEXT });
        return true;
      }
    }
  }

  /**
   * Last resort: If nothing is detected for > 5s, assume we're in a match.
   * @returns 
   */
  assumeInMatch() {
    if (this.state.type === GameStateType.UNKNOWN) return;
    if (this.state.type === GameStateType.MATCH) return;

    if ((Date.now() - this.lastUpdate) > 10000) {
      this.push({ type: GameStateType.MATCH, detectedBy: DetectionCause.FALLBACK });
    }
  }

  /**
   * Inform when game got closed.
   */
  onGameClosed() {
    this.push({ type: GameStateType.CLOSED });
  }

  /**
   * Inform when game got opened.
   */
  onGameOpened() {
    this.push({ type: GameStateType.UNKNOWN });
  }

  // Leverage shared normalization
  calculateTextMatch(original: string, test: string) {
    const a = MapResolver.Instance().normalizeForMatch(original);
    const b = MapResolver.Instance().normalizeForMatch(test);

    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;

    const dist = distance(a, b);
    const sim = 1 - dist / maxLen;
    return Math.max(0, Math.min(1, sim));
  }
}
