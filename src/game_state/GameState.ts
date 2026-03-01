import { distance } from "fastest-levenshtein";
import { MapDirectory } from "../generated-map-directory";
import { GameStateMap, MapResolver } from "../map_resolver/MapResolver";
import { OCRSingleResult, PureBlackResult } from "../utils/ocr/area-ocr";
import { createBus } from "../utils/window/window-bus";
import { BACKGROUND_SETTINGS } from "../windows/background/background-settings";
import { DetectableKillers, KillerDetection } from "./DetectableKillers";
import { DetectionCertainty, Killer } from "@diesermerlin/fog-companion-web";

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
  killer?: KillerDetection & { certainty: DetectionCertainty };
  killerGuess?: Killer;
  detectedBy?: DetectionCause;
};

type PendingTransition = {
  from: GameStateType;
  to: GameStateType;
  detectedBy?: DetectionCause;
  hits: number;
  firstSeen: number;
  lastSeen: number;
};

export const DetectionCertaintyWeight: { [key in DetectionCertainty]: number } = {
  [DetectionCertainty.BLIND_GUESS]: 0,
  [DetectionCertainty.UNCERTAIN]: 10,
  [DetectionCertainty.CERTAIN]: 20,
  [DetectionCertainty.AUTO_CONFIRMED]: 30,
  [DetectionCertainty.CONFIRMED]: 40,
}

const isEqualKiller = (a?: GameState['killer'], b?: GameState['killer']) => {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return a.name === b.name && a.certainty === b.certainty;
};

const isEqualMap = (a?: GameState['map'], b?: GameState['map']) => {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  if (
    a.name !== b.name ||
    a.realm !== b.realm ||
    a.mapFile !== b.mapFile ||
    a.fullPath !== b.fullPath ||
    a.imageUrl !== b.imageUrl
  ) return false;

  const aVariants = a.variants || [];
  const bVariants = b.variants || [];
  if (aVariants.length !== bVariants.length) return false;
  for (let i = 0; i < aVariants.length; i++) {
    if (aVariants[i].mapFile !== bVariants[i].mapFile || aVariants[i].realm !== bVariants[i].realm) {
      return false;
    }
  }
  return true;
};

const isEqual = (a: GameState, b: GameState) => {
  if (a === b) return true;
  return (
    a?.type === b?.type &&
    a?.detectedBy === b?.detectedBy &&
    a?.killerGuess === b?.killerGuess &&
    isEqualKiller(a?.killer, b?.killer) &&
    isEqualMap(a?.map, b?.map)
  );
};

// ===== GameStateGuesser (now delegates to MapResolver) =====

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
  private pendingTransition: PendingTransition | null = null;
  private readonly transitionWindowMs = 2500;

  private requiredTransitionHits(from: GameStateType, to: GameStateType, cause?: DetectionCause) {
    if (from === to) return 1;

    if (from === GameStateType.UNKNOWN && to === GameStateType.MENU) {
      return cause === DetectionCause.MAIN_MENU_TEXT ? 1 : 2;
    }

    if (from === GameStateType.UNKNOWN && to === GameStateType.LOADING) return 1;
    if (from === GameStateType.UNKNOWN && to === GameStateType.MATCH) {
      return cause === DetectionCause.MAP_TEXT ? 1 : 2;
    }

    if (from === GameStateType.MATCH && to === GameStateType.MENU) return 2;
    if (from === GameStateType.LOADING && to === GameStateType.MENU) return 2;

    return 1;
  }

  private confirmTransition(prev: GameState, next: GameState) {
    if (prev.type === next.type) {
      this.pendingTransition = null;
      return true;
    }

    const now = Date.now();
    const requiredHits = this.requiredTransitionHits(prev.type, next.type, next.detectedBy);
    const pending = this.pendingTransition;

    const sameTransition = !!pending
      && pending.from === prev.type
      && pending.to === next.type
      && pending.detectedBy === next.detectedBy
      && (now - pending.lastSeen) <= this.transitionWindowMs;

    if (sameTransition) {
      pending.hits += 1;
      pending.lastSeen = now;
    } else {
      this.pendingTransition = {
        from: prev.type,
        to: next.type,
        detectedBy: next.detectedBy,
        hits: 1,
        firstSeen: now,
        lastSeen: now,
      };
    }

    if ((this.pendingTransition?.hits || 0) >= requiredHits) {
      this.pendingTransition = null;
      return true;
    }

    return false;
  }

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
    if (next.type === GameStateType.MENU || next.type === GameStateType.CLOSED) {
      delete next.map;
    } else if (next.type !== GameStateType.MATCH) {
      next.map = next.map ?? prev.map;
    }

    if (prev.type !== GameStateType.MENU && next.type === GameStateType.MENU) {
      this.killerGuess = null;
      next.killer = null;
    } else next.killer = next.killer ?? prev.killer;

    next.killerGuess = this.killerGuess;

    if (!this.confirmTransition(prev, next)) return;

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
      const tokens = this.normalizeStringArray(res.text);

      if (type === 'main-menu')
        return (
          tokens.filter(line => ["play", "rift", "pass", "quests", "store"].some(keyword => line === keyword)).length >= 3
          && tokens.map(l => l.split(" ").filter(l => !!l)).flat().length < 15
        ) && DetectionCause.MAIN_MENU_TEXT;
      else if (type === 'menu-btn') { // Edge case: "play" in game-start disclaimer text.
        const menuBtnHits = tokens.filter(text => ["play", "continue", "cancel"].includes(text)).length;
        const requiredHits = this._state.type === GameStateType.UNKNOWN ? 2 : 1;
        return (menuBtnHits >= requiredHits) && DetectionCause.MENU_BUTTON_TEXT;
      }
      else if (type === 'bloodpoints')
        return (tokens.filter(text => text.match(/\d{3,}/g)).length >= 3) && DetectionCause.BLOODPOINTS_TEXT;
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

    const [highestMatch] = matches;
    if (!highestMatch || highestMatch.match < .85) return null;

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

    const lowerText = res.text.map(t => t.toLowerCase());

    const candidates = DetectableKillers
      .map((killer, index) => {
        const powerLabelHit = !!killer.detect.powerLabel?.some(dt =>
          lowerText.some(text => text.includes(dt.toLowerCase()))
        );
        const confirmLabelHit = !!killer.detect.confirmPowerLabel?.some(dt =>
          lowerText.some(text => text.includes(dt.toLowerCase()))
        );

        if (!powerLabelHit && !confirmLabelHit) return null;

        let score = 0;
        if (powerLabelHit) score += 20;
        if (confirmLabelHit) score += 30;
        if (this.state.killer?.name === killer.name) score += 6;
        if (this.killerGuess === killer.name) score += 4;

        return { killer, score, powerLabelHit, confirmLabelHit, index };
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score || a!.index - b!.index) as {
        killer: KillerDetection;
        score: number;
        powerLabelHit: boolean;
        confirmLabelHit: boolean;
        index: number;
      }[];

    const [best, second] = candidates;
    if (!best) return null;

    let certainty: DetectionCertainty;
    if (best.powerLabelHit && best.confirmLabelHit) {
      certainty = DetectionCertainty.AUTO_CONFIRMED;
    } else if (best.powerLabelHit && (!second || best.score > second.score)) {
      certainty = this.state.killer?.name === best.killer.name
        ? DetectionCertainty.AUTO_CONFIRMED
        : DetectionCertainty.CERTAIN;
    } else if (best.confirmLabelHit && !best.powerLabelHit && (!second || best.score > second.score)) {
      certainty = DetectionCertainty.BLIND_GUESS;
    } else {
      certainty = DetectionCertainty.UNCERTAIN;
    }

    const guess = { ...best.killer, certainty };
    this.killerGuess = guess.name;
    if (!!guess && DetectionCertaintyWeight[guess.certainty] >= DetectionCertaintyWeight[this.state.killer?.certainty ?? DetectionCertainty.BLIND_GUESS]) this.push({ ...this.state, killer: guess, detectedBy: DetectionCause.KILLER_POWER_TEXT });
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
        if (t.includes("...")) {
          const [namePart] = t.split("...");
          return dt.includes(namePart.toLowerCase());
        }
        return t.toLowerCase().includes(dt);
      }))) {
        this.killerGuess = killer.name;
        const guess = { ...killer, certainty: DetectionCertainty.BLIND_GUESS };
        if (!!guess && DetectionCertaintyWeight[guess.certainty] >= DetectionCertaintyWeight[this.state.killer?.certainty ?? DetectionCertainty.BLIND_GUESS])
          this.push({ ...this.state, killer: guess, detectedBy: DetectionCause.KILLER_NAME_TEXT });
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
