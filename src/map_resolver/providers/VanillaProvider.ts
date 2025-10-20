import { MapDirectory } from "../../generated-map-directory";
import { IMapFileProvider, MapFileEntry } from "../MapFileProvider";

/** Reads maps from MapDirectory (vanilla assets). */
export class VanillaProvider implements IMapFileProvider {
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
