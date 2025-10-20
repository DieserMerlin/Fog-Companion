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
};

const isEqual = (a: any, b: any) => a === b;

// ===== GameStateGuesser (mostly unchanged; now delegates to MapResolver) =====

export class GameStateGuesser {

  public readonly bus = createBus<{ gameState: GameState }>();

  constructor() {
    MapResolver.Instance().init().catch(() => { });
    BACKGROUND_SETTINGS.hook.subscribe(() => {
      this.push({ ...this.state });
    })
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

    if (result) this.push(this._state);
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

    let result = false;
    if (blackRes?.passed) result = true;

    if (textRes) {
      const words = this.normalizeStringArray(textRes.text);
      if ("connecting to other players".split(" ").every(w => words.includes(w))) result = true;
    }

    if (result) this.push({ type: GameStateType.LOADING });
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
        return (this.normalizeStringArray(res.text).filter(line => ["play", "rift", "pass", "quests", "store"].some(keyword => line === keyword)).length >= 3);
      else if (type === 'menu-btn')
        return (this.normalizeStringArray(res.text).some(text => ["play", "continue", "cancel"].includes(text)));
      else if (type === 'bloodpoints')
        return (this.normalizeStringArray(res.text).filter(text => text.match(/\d{3,}/g)).length >= 3);
    }
    const result = getResult();
    if (result) this.push({ type: GameStateType.MENU });
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
          match: this.calculateMapNameMatch(mapFile, guessedName),
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
      this.push({ type: GameStateType.MATCH, map: result });
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
        this.push({ ...this.state, killer });
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
      this.push({ type: GameStateType.MATCH });
    }
  }

  // Leverage shared normalization
  calculateMapNameMatch(original: string, test: string) {
    const a = MapResolver.Instance().normalizeForMatch(original);
    const b = MapResolver.Instance().normalizeForMatch(test);

    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;

    const dist = distance(a, b);
    const sim = 1 - dist / maxLen;
    return Math.max(0, Math.min(1, sim));
  }
}
