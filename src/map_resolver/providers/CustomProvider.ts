import { IMapFileProvider, MapFileEntry } from "../MapFileProvider";

export const ALLOWED_FILE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];

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