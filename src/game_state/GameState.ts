import { distance } from "fastest-levenshtein";
import { MapDirectory } from "../generated-map-directory";
import { GameStateMap, MapResolver } from "../map_resolver/MapResolver";
import { OCRSingleResult, PureBlackResult } from "../utils/ocr/area-ocr";
import { createBus } from "../utils/window/window-bus";
import { BACKGROUND_SETTINGS } from "../windows/background/background-settings";
import { DetectableKillers, Killer, KillerDetection, KillerDetectionCertainty } from "./DetectableKillers";

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
  KILLER_NAME_TEXT = 'KILLER_NAME_TEXT',
  FALLBACK = 'FALLBACK',
}

export type GameState = {
  type: GameStateType;
  map?: GameStateMap;
  killer?: KillerDetection & { certainty: KillerDetectionCertainty };
  killerGuess?: Killer;
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

  private killerGuess: Killer | null = null;

  private lastUpdate = Date.now();
  push(next: GameState) {
    const settings = BACKGROUND_SETTINGS.getValue();
    if (!settings.enableKillerDetection) {
      delete next.killer;
      this.killerGuess = null;
    }
    if (!settings.enableMapDetection) delete next.map;
    if (!settings.enableSmartFeatures) next = { type: GameStateType.UNKNOWN };

    const prev = this._state;
    if (isEqual(prev, next)) return;
    if (prev.type !== GameStateType.MATCH) next.map = prev.map;

    if (prev.type !== GameStateType.MENU && next.type === GameStateType.MENU) {
      this.killerGuess = null;
      next.killer = null;
    } else next.killer = next.killer ?? prev.killer;

    next.killerGuess = this.killerGuess;

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

    const lengthGate = (mapFile: string, guessedName: string) => {
      if (Math.abs(MapResolver.Instance().baseName(mapFile).length - guessedName.length) >= 3) return 0;
      return undefined;
    }

    const matches = (Object.keys(MapDirectory) as (keyof typeof MapDirectory)[])
      .flatMap((realm) =>
        (MapDirectory)[realm].map((mapFile: string) => ({
          realm,
          mapFile,
          match: lengthGate(mapFile, guessedName) ?? this.calculateTextMatch(mapFile, guessedName),
        }))
      )
      .sort((a, b) => b.match - a.match);

    console.log({ guessedName, matches });

    const [highestMatch] = matches;
    if (!highestMatch || highestMatch.match < .85) return null;

    console.log({ highestMatch });

    if (
      this._lastGuessedMap &&
      (Date.now() - this._lastGuessedMap.time) < 3000 && (
        highestMatch.match < this._lastGuessedMap.match || // Ignore worse matches
        highestMatch.mapFile.length < this._lastGuessedMap.mapFile.length // Ignore shorter matches (dissolving text)
      )
    ) return null;
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
  guessKillerByPower(res: OCRSingleResult) {
    if (!BACKGROUND_SETTINGS.getValue().enableKillerDetection) return null;
    if (this.state.type !== GameStateType.MATCH) return null;

    const performGuess = () => {
      // Confirm killer if already guessed
      const confirmKiller = !!this.killerGuess && (DetectableKillers.find(k => k.name === this.killerGuess));
      if (confirmKiller) {
        if (!!confirmKiller.detect.confirmPowerLabel?.length) {
          const detectTexts = confirmKiller.detect.confirmPowerLabel.map(t => t.toLowerCase());
          if (detectTexts.some(dt => res.text.some(t => t.toLowerCase().includes(dt)))) {
            return { certainty: KillerDetectionCertainty.CONFIRMED, ...confirmKiller };
          }
        }
      }

      const matching = DetectableKillers.filter(k => {
        if (!k.detect.powerLabel?.length) return;

        const detectTexts = k.detect.powerLabel.map(t => t.toLowerCase());
        return detectTexts.some(dt => res.text.some(t => t.toLowerCase().includes(dt)))
      });

      // No brainer
      if (matching.length === 1) {
        return { ...matching[0], certainty: (this.state.killer?.name === matching[0].name ? KillerDetectionCertainty.CONFIRMED : KillerDetectionCertainty.CERTAIN) };
      }

      // Fallback if multiple match (should not actually happen)
      if (matching.length > 1) {
        return { certainty: KillerDetectionCertainty.UNCERTAIN, ...matching[0] };
      }

      const matching2 = DetectableKillers.filter(k => {
        if (!!k.detect.confirmPowerLabel?.length) {
          const detectTexts = k.detect.confirmPowerLabel.map(t => t.toLowerCase());
          return detectTexts.some(dt => res.text.some(t => t.toLowerCase().includes(dt)));
        }
      });

      if (matching2[0]) return { certainty: KillerDetectionCertainty.BLIND_GUESS, ...matching2[0] };
      return null;
    }

    const guess = performGuess();
    if (!!guess && guess.certainty >= (this.state.killer?.certainty ?? 0)) this.push({ ...this.state, killer: guess, detectedBy: DetectionCause.KILLER_POWER_TEXT });
  }

  /**
   * Guess the current killer by their name and aliases.
   * @param res
   * @returns
   */
  guessKillerByName(res: OCRSingleResult) {
    if (!BACKGROUND_SETTINGS.getValue().enableKillerDetection) return false;
    if (this.state.type !== GameStateType.MENU) return false;

    for (const killer of DetectableKillers) {
      if (!killer.detect.names?.length) continue;
      const detectTexts = killer.detect.names.map(t => t.toLowerCase());

      if (detectTexts.some(dt => res.text.some(t => {
        console.log(dt);
        if (t.includes("...")) {
          const [namePart] = t.split("...");
          console.log({ t, namePart, dt, res: dt.includes(namePart.toLowerCase()) })
          return dt.includes(namePart.toLowerCase());
        }
        return t.toLowerCase().includes(dt);
      }))) {
        this.killerGuess = killer.name;
        const guess = { ...killer, certainty: KillerDetectionCertainty.BLIND_GUESS };
        if (!!guess && guess.certainty >= (this.state.killer?.certainty ?? 0)) this.push({ ...this.state, killer: guess, detectedBy: DetectionCause.KILLER_NAME_TEXT });
        return true;
      }
    }

    return false;
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
