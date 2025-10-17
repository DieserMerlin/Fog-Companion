import { distance } from "fastest-levenshtein";
import { MapDirectory } from "../generated-map-directory";
import { createBus } from "../utils/window/window-bus";
import { CALLOUT_SETTINGS } from "../windows/callouts/callout-settings";
import { OCRSingleResult, PureBlackResult } from "../utils/ocr/area-ocr";

// ===== Shared Types =====

export enum GameStateType {
  MENU = 'MENU',
  MATCH = 'MATCH',
  LOADING = 'LOADING',
  UNKNOWN = 'UNKNOWN',
}

export type GameStateMap = {
  name: string;
  realm: string;         // realm is only for browsing/paths; not used for matching
  mapFile: string;       // actual file name with extension
  fullPath: string;      // either disk path (custom) or relative path (vanilla)
  credit: string;
  variants?: GameStateMap[];
}

export type GameState = {
  type: GameStateType;
  map?: GameStateMap;
}

export type IndexedMapFile = {
  dir: string;
  fullPath: string;
  fileName: string;
  mapName: string;
  usable: boolean;
  realm: string; // inferred for custom maps (folder name or "Custom")
};

export const ALLOWED_FILE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];
const isEqual = (a: any, b: any) => a === b;

type RunningGameInfo = overwolf.games.RunningGameInfo;

// ===== File Provider Interface & Implementations =====

type MapFileEntry = {
  source: string;              // e.g. 'custom' | 'vanilla' | 'modX'
  realm: string;               // “browsing realm” (can be "Custom" or MapDirectory realm)
  fileName: string;            // file name WITH extension
  fullPath: string;            // absolute (custom) or relative (vanilla) path
};

export interface IMapFileProvider {
  id: string;
  /** Returns all map file entries available from this provider. */
  list(): Promise<MapFileEntry[]>;
}

/** Reads maps from MapDirectory (vanilla assets). */
class VanillaProvider implements IMapFileProvider {
  id = "vanilla";

  async list(): Promise<MapFileEntry[]> {
    const entries: MapFileEntry[] = [];
    for (const realm of Object.keys(MapDirectory)) {
      const files: string[] = (MapDirectory as any)[realm] || [];
      for (const file of files) {
        entries.push({
          source: this.id,
          realm,
          fileName: file,
          fullPath: `../../img/maps/${realm}/${file}`,
        });
      }
    }
    return entries;
  }
}

/** Indexes custom maps on disk (cached). */
class CustomProvider implements IMapFileProvider {
  id = "custom";
  private cache: MapFileEntry[] | null = null;

  async list(): Promise<MapFileEntry[]> {
    if (this.cache) return this.cache;

    const basePath = await new Promise<string>(res =>
      overwolf.settings.getOverwolfScreenshotsFolder(_res =>
        res(_res.path.Value + '\\DBD COMPanion\\CustomMaps')
      )
    );

    const exists = await new Promise<boolean>(res =>
      overwolf.io.exist(basePath, _res => res(_res.exist))
    );

    if (!exists) {
      console.log('Custom maps base path does not exist', basePath);
      this.cache = [];
      return this.cache;
    }

    const firstLevel = await new Promise<overwolf.io.FileInDir[]>(res =>
      overwolf.io.dir(basePath, _res => res(_res.data || []))
    );

    const entries: MapFileEntry[] = [];

    const add = (dirPath: string, file: overwolf.io.FileInDir, realmGuess: string) => {
      const name = file.name || "";
      const ext = name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
      if (!ext || !ALLOWED_FILE_EXTENSIONS.includes(ext)) return;

      entries.push({
        source: this.id,
        realm: realmGuess || "Custom",
        fileName: name,
        fullPath: dirPath + '\\' + name,
      });
    };

    // Files directly under base
    firstLevel.filter(f => f.type === 'file').forEach(f => add(basePath, f, "Custom"));

    // Subfolders -> folder name as realm hint
    const dirs = firstLevel.filter(f => f.type === 'dir');
    for (const d of dirs) {
      const dirPath = basePath + '\\' + d.name;
      const subExists = await new Promise<boolean>(res =>
        overwolf.io.exist(dirPath, _res => res(_res.exist))
      );
      if (!subExists) continue;

      const contents = await new Promise<overwolf.io.FileInDir[]>(res =>
        overwolf.io.dir(dirPath, _res => res(_res.data || []))
      );

      contents.filter(f => f.type === 'file').forEach(f => add(dirPath, f, d.name || "Custom"));
    }

    this.cache = entries;
    return this.cache;
  }
}

// ===== MapResolver =====

export class MapResolver {
  private static providers: IMapFileProvider[] = [new CustomProvider(), new VanillaProvider()];
  private static providerPriority: string[] = ["custom", "vanilla"]; // first is highest priority

  /** Register additional providers (e.g., mod managers) */
  static registerProvider(provider: IMapFileProvider, priorityHigherThan?: string) {
    if (priorityHigherThan) {
      const idx = MapResolver.providerPriority.indexOf(priorityHigherThan);
      const pidx = idx >= 0 ? idx : MapResolver.providerPriority.length;
      MapResolver.providerPriority.splice(pidx, 0, provider.id);
    } else {
      MapResolver.providerPriority.push(provider.id);
    }
    MapResolver.providers.unshift(provider); // put new provider at the front so it’s queried early
  }

  /** Preload providers that need indexing (optional). */
  static async init() {
    await Promise.all(this.providers.map(p => p.list().catch(() => [])));
  }

  // ---------- Normalization helpers (single source of truth) ----------

  /** Collapse whitespace to single spaces and trim. */
  static normalizeWhitespace(s: string): string {
    return s.replace(/\s+/g, ' ').trim();
  }

  /** Remove extension, collapse whitespace, remove trailing `_n_` (spaces tolerant). */
  static baseName(raw: string): string {
    const noExt = raw.replace(/\.[a-z0-9]+$/i, "");
    // Allow arbitrary spaces around underscores and the number, at the very end
    const noVar = noExt.replace(/\s*_+\s*\d+\s*_+\s*$/i, "");
    return MapResolver.normalizeWhitespace(noVar);
  }

  /** Extract numeric variation; returns 0 if none. Handles spaces: " _0_ ", "__1__", etc. */
  static variationNumber(raw: string): number {
    const noExt = raw.replace(/\.[a-z0-9]+$/i, "");
    const m = noExt.match(/\s*_+\s*(\d+)\s*_+\s*$/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  /** Normalization used for fuzzy matching via Levenshtein. */
  static normalizeForMatch(word: string): string {
    return MapResolver.baseName(
      word
        .trim()
        .replace(/[L|]/g, 'I')       // treat L and | like I
        .replace(/["'`´^]/g, '')     // remove extra chars
    ).toUpperCase();
  }

  // ---------- Aggregation & Resolution ----------

  /** Fetch all entries from all providers. */
  private static async allEntries(): Promise<MapFileEntry[]> {
    const lists = await Promise.all(this.providers.map(p => p.list()));
    return lists.flat();
  }

  /**
   * Collect ALL files (custom + vanilla + future providers) that share the same base name.
   * Matching is realm-agnostic; realms are preserved only for browsing/path building.
   */
  private static async collectAllForBase(base: string): Promise<MapFileEntry[]> {
    const target = MapResolver.normalizeForMatch(base);
    const entries = await this.allEntries();
    return entries.filter(e => MapResolver.normalizeForMatch(e.fileName) === target);
  }

  /** Sort keys: provider priority, then prefer no variation (0), then lowest number. */
  private static sortByPreference(a: MapFileEntry, b: MapFileEntry): number {
    const pr = (id: string) => {
      const idx = MapResolver.providerPriority.indexOf(id);
      return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
    };
    const pa = pr(a.source);
    const pb = pr(b.source);
    if (pa !== pb) return pa - pb;

    const va = MapResolver.variationNumber(a.fileName);
    const vb = MapResolver.variationNumber(b.fileName);
    if (va === 0 && vb !== 0) return -1;
    if (vb === 0 && va !== 0) return 1;
    return va - vb;
  }

  /**
   * Build a GameStateMap for a given seed (realm/file from detection).
   * Realm is ignored for matching; we group by base name across ALL providers.
   */
  public static async makeMap(seed: { realm: string; mapFile: string }): Promise<GameStateMap | null> {
    const base = MapResolver.baseName(seed.mapFile); // tolerant to spaces/extension
    const candidates = await MapResolver.collectAllForBase(base);

    if (candidates.length === 0) {
      // Fallback: return the seed as vanilla-like entry
      return {
        credit: 'hens333.com',
        name: base,
        realm: seed.realm,
        mapFile: seed.mapFile,
        fullPath: `../../img/maps/${seed.realm}/${seed.mapFile}`,
      };
    }

    // Determine main by provider priority then variation number
    const sorted = [...candidates].sort(MapResolver.sortByPreference);
    const main = sorted[0];
    const rest = sorted.slice(1);

    const toGSM = (e: MapFileEntry): GameStateMap => ({
      credit: 'hens333.com',
      name: base,
      realm: e.realm,
      mapFile: e.fileName,
      fullPath: e.fullPath,
    });

    const variants = rest
      .sort((a, b) => MapResolver.variationNumber(a.fileName) - MapResolver.variationNumber(b.fileName))
      .map(toGSM);

    const mainGsm = toGSM(main);
    if (variants.length > 0) {
      mainGsm.variants = variants;
    }
    return mainGsm;
  }
}

// ===== GameStateGuesser (mostly unchanged; now delegates to MapResolver) =====

export class GameStateGuesser {

  public readonly bus = createBus<{ gameState: GameState }>();

  constructor() {
    let inFocus = true, lastExternalActivity = Date.now();
    let polling = false;
    setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const { isInFocus } = await new Promise<RunningGameInfo>((res, rej) => {
          overwolf.games.getRunningGameInfo(res);
          setTimeout(rej, 900);
        });
        if (!inFocus && isInFocus) lastExternalActivity = Date.now();
        inFocus = isInFocus;

        if (!isInFocus) return;

        const lastUpdate = Math.max(lastExternalActivity, this.lastStateUpdate);
        if ((Date.now() - lastUpdate) > 10000 && this._state.type !== GameStateType.MATCH) this.push({ type: GameStateType.MATCH });
      } finally {
        polling = false;
      }
    }, 1000);

    MapResolver.init().catch(() => { });
  }

  private lastStateUpdate = Date.now();
  private _state: GameState = { type: GameStateType.MENU };

  public get state() {
    return this._state;
  }

  publishGameStateChange(prev: GameState, next: GameState) {
    if (!isEqual(prev, next)) {
      this.bus.emit('gameState', next);
    }
  }

  push(next: GameState) {
    const prev = this._state;
    if (isEqual(prev, next)) return;
    if (prev.type !== GameStateType.MATCH) next.map = prev.map;

    this._state = next;
    this.lastStateUpdate = Date.now();
    this.publishGameStateChange(prev, next);
  }

  guessSettings(type: 'left' | 'right', res: OCRSingleResult) {
    const result = type === 'left'
      ? res.text.filter(text => ["back", "esc", "apply changes"].some(keyword => keyword.includes(text.toLowerCase()))).length >= 1
      : res.text.filter(text => ["general", "accessibility", "beta", "online", "graphics", "audio", "controls", "input binding", "support", "match details", "general"].includes(text.toLowerCase())).length >= 6;
    if (result) this.push(this._state);
    return result;
  }

  guessLoadingScreen(blackRes?: PureBlackResult, textRes?: OCRSingleResult) {
    let result = false;
    if (blackRes?.passed) result = true;
    if (textRes?.text.some(text => text.toLowerCase().includes("connecting to other players"))) result = true;
    if (result) this.push({ type: GameStateType.LOADING });
    return result;
  }

  guessMenu(type: 'main-menu' | 'bloodpoints' | 'menu-btn', res: OCRSingleResult) {
    const getResult = () => {
      if (type === 'main-menu')
        return (res.text.filter(line => ["play", "rift pass", "quests", "store"].some(keyword => line.toLowerCase() === keyword)).length >= 2);
      else if (type === 'menu-btn')
        return (res.text.some(text => ["play", "continue", "cancel"].includes(text.toLowerCase())));
      else if (type === 'bloodpoints')
        return (res.text.filter(text => text.match(/\d{3,}/g)).length >= 3);
    }
    const result = getResult();
    if (result) this.push({ type: GameStateType.MENU });
    return result;
  }

  private _lastGuessedMap: { time: number, mapFile: string, match: number } | undefined;

  guessMap(guessedName: string): GameStateMap | null {
    if (!CALLOUT_SETTINGS.getValue().autoDetect) return null;

    // retain your original ranking (uses MapDirectory only, for speed)
    const matches = Object.keys(MapDirectory)
      .flatMap(realm =>
        (MapDirectory as any)[realm].map((mapFile: string) => ({
          realm,
          mapFile,
          match: this.calculateMapNameMatch(mapFile, guessedName),
        }))
      )
      .sort((a, b) => b.match - a.match);

    const [highestMatch] = matches;
    if (!highestMatch || highestMatch.match < .92) return null;

    if (this._lastGuessedMap && (Date.now() - this._lastGuessedMap.time) > 3000 && highestMatch.match < this._lastGuessedMap.match) return null;
    this._lastGuessedMap = { time: Date.now(), ...highestMatch };

    // Now build the final map using ALL providers (realm-agnostic matching, custom-priority, full variants)
    MapResolver.makeMap({ realm: highestMatch.realm, mapFile: highestMatch.mapFile })
      .then(result => {
        if (result) this.push({ type: GameStateType.MATCH, map: result });
      })
      .catch(() => { /* ignore */ });

    // We return null synchronously because push happens when async completes.
    // If you prefer sync behavior, await the call above and return the result directly.
    return null;
  }

  // Leverage shared normalization
  calculateMapNameMatch(original: string, test: string) {
    const a = MapResolver.normalizeForMatch(original);
    const b = MapResolver.normalizeForMatch(test);

    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;

    const dist = distance(a, b);
    const sim = 1 - dist / maxLen;
    return Math.max(0, Math.min(1, sim));
  }
}
