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
