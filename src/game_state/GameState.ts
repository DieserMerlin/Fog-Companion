import { distance } from "fastest-levenshtein";
import { MapDirectory } from "../generated-map-directory";
import { createBus } from "../utils/window/window-bus";
import { CALLOUT_SETTINGS } from "../windows/callouts/callout-settings";
import { OCRSingleResult, PureBlackResult } from "../utils/ocr/area-ocr";
import { BACKGROUND_SETTINGS } from "../windows/background/background-settings";

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
  imageUrl: string;            // Image url for usage in css
  credit: string;
  variants?: GameStateMap[];
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

export const ALLOWED_FILE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];
const isEqual = (a: any, b: any) => a === b;

// ===== File Provider Interface & Implementations =====

export type MapFileEntry = {
  source: string;              // e.g. 'custom' | 'vanilla' | 'modX'
  realm: string;               // “browsing realm” (can be "Custom" or MapDirectory realm)
  fileName: string;            // file name WITH extension
  fullPath: string;            // absolute (custom) or relative (vanilla) path
  imageUrl: string;            // Image url for usage in css
};

export type MapGroup = {
  baseName: string;
  realm: string;            // chosen main realm (browsing only)
  main: MapFileEntry;
  variants: MapFileEntry[]; // others sorted by variation number
};

export interface IMapFileProvider {
  id: string;
  /** Returns all map file entries available from this provider. */
  list(): Promise<MapFileEntry[]>;
  clearCache?: () => void;
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
          imageUrl: `../../img/maps/${realm}/${file}`
        });
      }
    }
    return entries;
  }
}

/** Indexes custom maps on disk (cached). */
export class CustomProvider implements IMapFileProvider {
  id = "custom";
  private cache: MapFileEntry[] | null = null;

  clearCache() { this.cache = null };

  // static instance
  static Instance(): CustomProvider {
    const cache = overwolf.windows.getMainWindow().cache;
    if (!cache.customProvider) cache.customProvider = new CustomProvider();
    return cache.customProvider;
  }

  async folderExists() {
    const basePath = await new Promise<string>(res =>
      overwolf.settings.getOverwolfScreenshotsFolder(_res =>
        res(_res.path.Value + '\\Fog Companion\\CustomMaps')
      )
    );

    const exists = await new Promise<boolean>(res =>
      overwolf.io.exist(basePath, _res => res(_res.exist))
    );

    return { basePath, exists };
  }

  async list(): Promise<MapFileEntry[]> {
    if (this.cache) return this.cache;

    const { exists, basePath } = await this.folderExists();

    if (!exists) {
      console.log('Custom maps base path does not exist', basePath);
      this.cache = [];
      return this.cache;
    }

    const firstLevel = await new Promise<overwolf.io.FileInDir[]>(res =>
      overwolf.io.dir(basePath, _res => res(_res.data || []))
    );

    type ReadFileOpts = {
      fullPath: string;
      mime?: string;                // z.B. 'image/png'
      as?: 'blob-url' | 'data-url'; // Ausgabeformat
    };

    function readFile({ fullPath, mime = 'image/png', as = 'blob-url' }: ReadFileOpts): Promise<string> {
      return new Promise((resolve, reject) => {
        // @ts-expect-error: OW types
        overwolf.io.readBinaryFile(fullPath, {}, (rb: any) => {
          if (!rb || rb.success === false || !rb.content) {
            console.error('[readFile] Failed to read binary:', rb);
            reject(rb);
            return;
          }

          const bytes = new Uint8Array(rb.content as number[]);
          const blob = new Blob([bytes], { type: mime });

          if (as === 'data-url') {
            const reader = new FileReader();
            reader.onload = () => {
              const out = reader.result as string; // data:<mime>;base64,...
              console.log('[readFile] data-url len:', out?.length);
              resolve(out);
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(blob);
            return;
          }

          const url = URL.createObjectURL(blob); // blob:overwolf-extension://...
          console.log('[readFile] blob-url:', url);
          resolve(url.toString());
        });
      });
    }
    const entries: MapFileEntry[] = [];

    const add = async (dirPath: string, file: overwolf.io.FileInDir, realmGuess: string) => {
      const name = file.name || "";
      const ext = name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
      if (!ext || !ALLOWED_FILE_EXTENSIONS.includes(ext)) return;

      const fullPath = dirPath + '\\' + name;
      const imageUrl = await readFile({ fullPath, as: 'data-url' });
      console.log(imageUrl);

      entries.push({
        source: this.id,
        realm: realmGuess || "Custom",
        fileName: name,
        fullPath,
        imageUrl
      });
    };

    // Files directly under base
    await Promise.all(firstLevel.filter(f => f.type === 'file').map(f => add(basePath, f, "Custom").then(res => console.log({ res }))));

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

      await Promise.all(contents.filter(f => f.type === 'file').map(f => add(dirPath, f, d.name || "Custom").then(console.log)));
    }

    this.cache = entries;
    return this.cache;
  }
}

// ===== MapResolver =====

export class MapResolver {
  private providers: IMapFileProvider[] = [CustomProvider.Instance(), new VanillaProvider()];
  private providerPriority: string[] = ["custom", "vanilla"]; // first is highest priority

  private _cachedEntries: MapFileEntry[] = [];

  getCachedEntries() {
    return this._cachedEntries;
  }

  /**
   * Reloads and caches ALL map entries from all providers.
   * Call this to refresh; otherwise cached data is used.
   */
  async reloadCache() {
    const lists = await Promise.all(this.providers.map(p => { p.clearCache?.(); return p.list().catch(() => []) }));
    console.log({ lists });
    this._cachedEntries = lists.flat();
  }

  /** Preload providers & fill cache (optional). */
  async init() {
    await this.reloadCache();
  }

  // static instance
  static Instance(): MapResolver {
    const cache = overwolf.windows.getMainWindow().cache;
    if (!cache.mapResolver) cache.mapResolver = new MapResolver();
    return cache.mapResolver;
  }

  /** Register additional providers (e.g., mod managers) */
  registerProvider(provider: IMapFileProvider, priorityHigherThan?: string) {
    if (priorityHigherThan) {
      const idx = this.providerPriority.indexOf(priorityHigherThan);
      const pidx = idx >= 0 ? idx : this.providerPriority.length;
      this.providerPriority.splice(pidx, 0, provider.id);
    } else {
      this.providerPriority.push(provider.id);
    }
    this.providers.unshift(provider); // put new provider at the front so it’s queried early
  }

  // ---------- Normalization helpers (single source of truth) ----------

  /** Collapse whitespace to single spaces and trim. */
  normalizeWhitespace(s: string): string {
    return s.replace(/\s+/g, ' ').trim();
  }

  /** Remove extension, collapse whitespace, remove trailing `_n_` (spaces tolerant). */
  baseName(raw: string): string {
    const noExt = raw.replace(/\.[a-z0-9]+$/i, "");
    // Allow arbitrary spaces around underscores and the number, at the very end
    const noVar = noExt.replace(/\s*_+\s*\d+\s*_+\s*$/i, "");
    return this.normalizeWhitespace(noVar);
  }

  /** Extract numeric variation; returns 0 if none. Handles spaces: " _0_ ", "__1__", etc. */
  variationNumber(raw: string): number {
    const noExt = raw.replace(/\.[a-z0-9]+$/i, "");
    const m = noExt.match(/\s*_+\s*(\d+)\s*_+\s*$/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  /** Normalization used for fuzzy matching via Levenshtein. */
  normalizeForMatch(word: string): string {
    return word
      .trim()
      .toUpperCase()
      .replace(/[L|1]/g, 'I')              // treat L, 1 and | like I (AFTER uppercasing)
      .replace(/["'`´^]/g, '')            // remove extra chars
      .replace(/\.[A-Z0-9]+$/, '')        // remove file extension
      .replace(/\s*_+\s*\d+\s*_+\s*$/, '')// strip trailing _n_ (whitespace tolerant)
      .replace(/\s+/g, ' ');              // collapse whitespace
  }

  // ---------- Aggregation & Resolution (now using cache, sync) ----------

  /** Fetch all entries from cache (no I/O). */
  private allEntriesFromCache(): MapFileEntry[] {
    return this._cachedEntries || [];
  }

  /**
   * Collect ALL files (custom + vanilla + future providers) that share the same base name.
   * Matching is realm-agnostic; realms are preserved only for browsing/path building.
   */
  private collectAllForBase(base: string): MapFileEntry[] {
    const target = this.normalizeForMatch(base);
    const entries = this.allEntriesFromCache();
    return entries.filter(e => this.normalizeForMatch(e.fileName) === target);
  }

  /** Sort keys: provider priority, then prefer no variation (0), then lowest number. */
  private sortByPreference(a: MapFileEntry, b: MapFileEntry): number {
    const pr = (id: string) => {
      const idx = this.providerPriority.indexOf(id);
      return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
    };
    const pa = pr(a.source);
    const pb = pr(b.source);
    if (pa !== pb) return pa - pb;

    const va = this.variationNumber(a.fileName);
    const vb = this.variationNumber(b.fileName);
    if (va === 0 && vb !== 0) return -1;
    if (vb === 0 && va !== 0) return 1;
    return va - vb;
  }

  /**
   * Build a GameStateMap for a given seed (realm/file from detection) synchronously
   * using cached entries. Realm is ignored for matching; we group by base name across ALL providers.
   */
  public makeMap(seed: { realm: string; mapFile: string }): GameStateMap | null {
    const base = this.baseName(seed.mapFile); // tolerant to spaces/extension
    const candidates = this.collectAllForBase(base);

    if (candidates.length === 0) {
      // Fallback
      return null
    }

    // Determine main by provider priority then variation number
    const sorted = [...candidates].sort((a, b) => this.sortByPreference(a, b));
    const main = sorted[0];
    const rest = sorted.slice(1);

    const toGSM = (e: MapFileEntry): GameStateMap => ({
      credit: e.source !== 'custom' ? 'hens333.com' : undefined,
      name: base,
      realm: e.realm,
      mapFile: e.fileName,
      fullPath: e.fullPath,
      imageUrl: e.imageUrl,
    });

    const variants = rest
      .sort((a, b) => this.variationNumber(a.fileName) - this.variationNumber(b.fileName))
      .map(toGSM);

    const mainGsm = toGSM(main);
    if (variants.length > 0) {
      mainGsm.variants = variants;
    }
    return mainGsm;
  }

  private byProviderPriority(a: MapFileEntry, b: MapFileEntry): number {
    const idx = (id: string) => {
      const i = this.providerPriority.indexOf(id);
      return i >= 0 ? i : Number.MAX_SAFE_INTEGER;
    };
    return idx(a.source) - idx(b.source);
  }

  private byVariation(a: MapFileEntry, b: MapFileEntry): number {
    const av = this.variationNumber(a.fileName);
    const bv = this.variationNumber(b.fileName);
    if (av === 0 && bv !== 0) return -1;
    if (bv === 0 && av !== 0) return 1;
    return av - bv;
  }

  private sortPreferred(a: MapFileEntry, b: MapFileEntry): number {
    const p = this.byProviderPriority(a, b);
    return p !== 0 ? p : this.byVariation(a, b);
  }

  public listGroups(): MapGroup[] {
    const all = this.allEntriesFromCache();

    // 1) Group by normalized base name (realm-agnostic).
    const byBase = new Map<string, MapFileEntry[]>();
    // Track which realms contain entries for each base (for visual duplication later).
    const realmsByBase = new Map<string, Set<string>>();

    for (const e of all) {
      const baseKey = this.normalizeForMatch(e.fileName); // realm-agnostic key
      const list = byBase.get(baseKey);
      if (list) list.push(e); else byBase.set(baseKey, [e]);

      const rs = realmsByBase.get(baseKey);
      if (rs) rs.add(e.realm); else realmsByBase.set(baseKey, new Set([e.realm]));
    }

    const groups: MapGroup[] = [];

    // 2) Build the canonical (main + variants) once per base, then duplicate per realm.
    for (const [baseKey, entries] of byBase) {
      // Choose main by provider priority, then prefer no suffix (0), then lowest number.
      const preferred = [...entries].sort((a, b) => this.sortPreferred(a, b));
      const main = preferred[0];
      const rest = preferred.slice(1).sort((a, b) => this.byVariation(a, b));

      // Canonical base name (nicely formatted).
      const baseName = this.baseName(main.fileName);

      // Realms that should visually display this same group.
      const realms = Array.from(realmsByBase.get(baseKey) || []);

      // For each realm that contains this base, create a group entry that points to the SAME files.
      for (const realm of realms) {
        groups.push({
          baseName,
          realm,
          main,
          variants: rest, // same canonical variants everywhere (count reflects total across sources/realms)
        });
      }
    }

    // 3) Sort: Custom realm first, then base name A→Z, then realm A→Z for stability.
    return groups.sort((a, b) => {
      const aIsCustom = a.realm.toLowerCase() === "custom";
      const bIsCustom = b.realm.toLowerCase() === "custom";
      if (aIsCustom !== bIsCustom) return aIsCustom ? -1 : 1;

      const byName = a.baseName.localeCompare(b.baseName);
      if (byName !== 0) return byName;

      return a.realm.localeCompare(b.realm);
    });
  }

  /** 2b) realm -> base name -> variant count (excluding main) */
  public countsByRealm(): Record<string, Record<string, number>> {
    const groups = this.listGroups();
    const out: Record<string, Record<string, number>> = {};
    for (const g of groups) {
      if (!out[g.realm]) out[g.realm] = {};
      out[g.realm][g.baseName] = g.variants.length;
    }
    return out;
  }

  /** 3) Rehydrate by name (realm-agnostic): return GameStateMap with variants */
  public makeMapByName(baseName: string): GameStateMap | null {
    const all = this.allEntriesFromCache();
    const key = this.normalizeForMatch(baseName);
    const candidates = all.filter(e => this.normalizeForMatch(e.fileName) === key);
    if (candidates.length === 0) return null;

    const seed = [...candidates].sort((a, b) => this.sortPreferred(a, b))[0];
    return this.makeMap({ realm: seed.realm, mapFile: seed.fileName });
  }

}

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

    // Now build the final map using ALL providers (realm-agnostic matching, custom-priority, full variants)
    const result = MapResolver.Instance().makeMap({
      realm: highestMatch.realm,
      mapFile: highestMatch.mapFile,
    });

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
