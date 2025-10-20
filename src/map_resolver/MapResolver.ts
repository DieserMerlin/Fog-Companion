// MapResolver.ts
import { IMapFileProvider, MapFileEntry, MapGroup } from "./MapFileProvider";
import { CustomProvider } from "./providers/CustomProvider";
import { VanillaProvider } from "./providers/VanillaProvider";

export type GameStateMap = {
  name: string;
  realm: string;         // realm is only for browsing/paths; not used for matching
  mapFile: string;       // actual file name with extension
  fullPath: string;      // either disk path (custom) or relative path (vanilla)
  imageUrl: string;      // Image url for usage in css
  credit: string | undefined;
  variants?: GameStateMap[];
}

export class MapResolver {
  private providers: IMapFileProvider[] = [CustomProvider.Instance(), new VanillaProvider()];
  private providerPriority: string[] = ["custom", "vanilla"]; // default global priority

  private _cachedEntries: MapFileEntry[] = [];

  getCachedEntries() { return this._cachedEntries; }

  async reloadCache() {
    const lists = await Promise.all(this.providers.map(p => { p.clearCache?.(); return p.list().catch(() => []) }));
    this._cachedEntries = lists.flat();
  }

  async init() { await this.reloadCache(); }

  static Instance(): MapResolver {
    const cache = overwolf.windows.getMainWindow().cache;
    if (!cache.mapResolver) cache.mapResolver = new MapResolver();
    return cache.mapResolver;
  }

  registerProvider(provider: IMapFileProvider, priorityHigherThan?: string) {
    if (priorityHigherThan) {
      const idx = this.providerPriority.indexOf(priorityHigherThan);
      const pidx = idx >= 0 ? idx : this.providerPriority.length;
      this.providerPriority.splice(pidx, 0, provider.id);
    } else {
      this.providerPriority.push(provider.id);
    }
    this.providers.unshift(provider);
  }

  // ---------- Normalization helpers ----------

  normalizeWhitespace(s: string): string {
    return s.replace(/\s+/g, ' ').trim();
  }

  baseName(raw: string): string {
    const noExt = raw.replace(/\.[a-z0-9]+$/i, "");
    const noVar = noExt.replace(/\s*_+\s*\d+\s*_+\s*$/i, "");
    return this.normalizeWhitespace(noVar);
  }

  variationNumber(raw: string): number {
    const noExt = raw.replace(/\.[a-z0-9]+$/i, "");
    const m = noExt.match(/\s*_+\s*(\d+)\s*_+\s*$/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  normalizeForMatch(word: string): string {
    return word
      .trim()
      .toUpperCase()
      .replace(/["'`´^]/g, '')
      .replace(/\.[A-Z0-9]+$/, '')
      .replace(/\s*_\d_$/, '')
      .replace(/[L|1]/g, 'I')
      .replace(/\s+/g, ' ');
  }

  // ---------- Cache & collection ----------

  private allEntriesFromCache(): MapFileEntry[] { return this._cachedEntries || []; }

  private collectAllForBase(base: string): MapFileEntry[] {
    const target = this.normalizeForMatch(base);
    const entries = this.allEntriesFromCache();
    return entries.filter(e => this.normalizeForMatch(e.fileName) === target);
  }

  // ---------- Sorting helpers ----------

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

  /** Realm-aware comparator: prefer provider(s) depending on the seed realm. */
  private comparatorForContext(seedRealm: string | null, pool: MapFileEntry[]) {
    // If the seed realm actually has a vanilla entry, do vanilla-first. Otherwise custom-first.
    const seedHasVanilla = !!(seedRealm && pool.some(e => e.source === "vanilla" && e.realm === seedRealm));
    const mode: "vanilla-first" | "custom-first" =
      seedHasVanilla ? "vanilla-first" : (seedRealm ? "custom-first" : "custom-first");

    const rank = (e: MapFileEntry): number => {
      if (mode === "vanilla-first") {
        if (e.source === "vanilla" && seedRealm && e.realm === seedRealm) return 0; // exact vanilla realm first
        if (e.source === "vanilla") return 1;
        return 2; // customs after vanilla when anchored to a vanilla realm
      } else {
        // custom-first (e.g., browsing "Custom" realms)
        if (e.source === "custom" && seedRealm && e.realm === seedRealm) return 0; // customs in that realm first
        if (e.source === "custom") return 1;
        return 2; // vanilla last
      }
    };

    return (a: MapFileEntry, b: MapFileEntry): number => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;

      // Prefer same realm as the seed inside the same bucket
      if (seedRealm) {
        const ar = a.realm === seedRealm ? 0 : 1;
        const br = b.realm === seedRealm ? 0 : 1;
        if (ar !== br) return ar - br;
      }

      // Then variation (base/no suffix first, then _1_, _2_, ...)
      const v = this.byVariation(a, b);
      if (v !== 0) return v;

      // Stable fallback
      const p = this.byProviderPriority(a, b);
      if (p !== 0) return p;

      return a.fileName.localeCompare(b.fileName);
    };
  }

  // ---------- Build GameStateMap (realm-aware ordering) ----------

  public makeMap(seed: { realm: string; mapFile: string }): GameStateMap | null {
    const base = this.baseName(seed.mapFile);
    const candidates = this.collectAllForBase(base);
    if (candidates.length === 0) return null;

    const sorted = [...candidates].sort(this.comparatorForContext(seed.realm, candidates));
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

    const mainGsm = toGSM(main);
    if (rest.length > 0) mainGsm.variants = rest.map(toGSM);
    return mainGsm;
  }

  // ---------- Browser groups (duplicate per realm with realm-aware ordering) ----------

  public listGroups(): MapGroup[] {
    const all = this.allEntriesFromCache();

    // Group by normalized base name.
    const byBase = new Map<string, MapFileEntry[]>();
    // Track realms per base.
    const realmsByBase = new Map<string, Set<string>>();

    for (const e of all) {
      const key = this.normalizeForMatch(e.fileName);
      if (!byBase.has(key)) byBase.set(key, []);
      byBase.get(key)!.push(e);

      if (!realmsByBase.has(key)) realmsByBase.set(key, new Set());
      realmsByBase.get(key)!.add(e.realm);
    }

    const groups: MapGroup[] = [];

    for (const [baseKey, entries] of byBase) {
      const realms = Array.from(realmsByBase.get(baseKey) || []);
      // For each realm that contains this base, build a group ordered for THAT realm.
      for (const realm of realms) {
        const ordered = [...entries].sort(this.comparatorForContext(realm, entries));
        const main = ordered[0];
        const variants = ordered.slice(1);

        groups.push({
          baseName: this.baseName(main.fileName),
          realm,
          main,
          variants
        });
      }
    }

    // Browser sorting: Custom section first, then A→Z by base, then realm A→Z.
    return groups.sort((a, b) => {
      const aIsCustom = a.realm.toLowerCase() === "custom";
      const bIsCustom = b.realm.toLowerCase() === "custom";
      if (aIsCustom !== bIsCustom) return aIsCustom ? -1 : 1;

      const byName = a.baseName.localeCompare(b.baseName);
      if (byName !== 0) return byName;

      return a.realm.localeCompare(b.realm);
    });
  }

  /** realm -> base name -> variant count (excluding main) */
  public countsByRealm(): Record<string, Record<string, number>> {
    const groups = this.listGroups();
    const out: Record<string, Record<string, number>> = {};
    for (const g of groups) {
      if (!out[g.realm]) out[g.realm] = {};
      out[g.realm][g.baseName] = g.variants.length;
    }
    return out;
  }

  /** Rehydrate by name with optional realm-aware ordering. */
  public makeMapByName(baseName: string, preferRealm?: string): GameStateMap | null {
    const all = this.allEntriesFromCache();
    const key = this.normalizeForMatch(baseName);
    const candidates = all.filter(e => this.normalizeForMatch(e.fileName) === key);
    if (candidates.length === 0) return null;

    const realm = preferRealm ?? (candidates[0]?.realm ?? "Custom");
    const sorted = [...candidates].sort(this.comparatorForContext(realm, candidates));
    return this.makeMap({ realm, mapFile: sorted[0].fileName });
  }
}
