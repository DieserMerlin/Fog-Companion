import { createWorker, PSM, Worker } from "tesseract.js";

const STATIC_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_/() .,|";

// --- defaults you can tweak ---
const DEFAULT_LUM_MIN = 120;
const DEFAULT_CHROMA_MAX = 18;
const MID_GRAY_LUM_MIN = 150;
const MID_GRAY_CHROMA_MAX = 10;

// --- NEW defaults for the edge-uniform detector ---
const DEFAULT_BLACK_MAX = 12;
const DEFAULT_SAMPLE_STRIDE = 2;
const DEFAULT_MIN_MATCH_RATIO = 0.98;
const DEFAULT_COLOR_DELTA_MAX = 8;

// ---------- Worker Pool (3 workers) ----------
type WorkerWithParams = Worker & { __lastParams?: Record<string, string> };

class TesseractPool {
  private size: number;
  private pool: WorkerWithParams[] = [];
  private queue: Array<(w: WorkerWithParams) => Promise<void>> = [];
  private busy = 0;
  private initPromise: Promise<void> | null = null;

  constructor(size = 3) { this.size = size; }

  private async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      const workers = await Promise.all(
        Array.from({ length: this.size }, async () => {
          const w = (await createWorker("eng")) as WorkerWithParams;
          // sensible defaults; per-job overrides below
          await w.setParameters({
            tessedit_pageseg_mode: PSM.SPARSE_TEXT_OSD,
            preserve_interword_spaces: "1",
            tessedit_char_whitelist: STATIC_WHITELIST,
          });
          w.__lastParams = {
            tessedit_pageseg_mode: String(PSM.SPARSE_TEXT_OSD),
            preserve_interword_spaces: "1",
            tessedit_char_whitelist: STATIC_WHITELIST,
          };
          return w;
        })
      );
      this.pool.push(...workers);
    })();
    return this.initPromise;
  }

  async runJob<T>(fn: (w: WorkerWithParams) => Promise<T>): Promise<T> {
    await this.init();
    return new Promise<T>((resolve, reject) => {
      const job = async (worker: WorkerWithParams) => {
        try {
          this.busy++;
          const res = await fn(worker);
          resolve(res);
        } catch (e) {
          reject(e);
        } finally {
          this.busy--;
          // return worker to pool and tick queue
          this.pool.push(worker);
          this.tick();
        }
      };
      this.queue.push(job as any);
      this.tick();
    });
  }

  private tick() {
    while (this.pool.length && this.queue.length) {
      const w = this.pool.pop()!;
      const j = this.queue.shift()!;
      // fire and forget (promise handled in runJob)
      j(w);
    }
  }

  async destroy() {
    // optional: call when app shuts down
    await Promise.all(this.pool.map(w => w.terminate()));
    this.pool.length = 0;
  }
}

const pool = new TesseractPool(3);

// ---------- Public API ----------
export type NormalizedRect = { x: number; y: number; w: number; h: number };

export type ScanArea = {
  id: string;
  rect: NormalizedRect;
  threshold?: number;
  psm?: PSM;
  whitelist?: string;
  lumMin?: number;
  chromaMax?: number;
};

export type OcrScanArea = ScanArea & { type?: "ocr" };

export type PureBlackScanArea = {
  id: string;
  type: "pure-black";
  rects: NormalizedRect[];
  blackMax?: number;
  sampleStride?: number;
  minMatchRatio?: number;
  colorDeltaMax?: number;
};

export type AnyScanArea = OcrScanArea | PureBlackScanArea;

export type OCRSingleResult = { type: "ocr"; text: string[]; confidence: number };
export type PureBlackResult = {
  type: "pure-black";
  passed: boolean;
  ratio: number;
  tested: number;
  matched: number;
  dominant?: { r: number; g: number; b: number };
  firstFail?: { x: number; y: number; r: number; g: number; b: number; a: number };
};

export type OcrAreasResult = Record<string, OCRSingleResult | PureBlackResult>;

/**
 * Captures a screenshot (while the game is focused) and OCRs multiple areas.
 * Now uses a 3-worker scheduler to process areas concurrently.
 */
export async function performOcrAreas(areas: AnyScanArea[]): Promise<OcrAreasResult | null> {
  // 0) Ensure there's a running, focused game.
  const gi = await new Promise<overwolf.games.GetRunningGameInfoResult>((resolve) =>
    overwolf.games.getRunningGameInfo(resolve)
  );
  if (!gi || !gi.success || !gi.isRunning || !gi.isInFocus) {
    return null;
  }

  // 1) Take screenshot
  const shot = await new Promise<overwolf.media.FileResult>((resolve) =>
    overwolf.media.takeScreenshot(resolve)
  );
  if (!shot.success || !shot.url || !shot.path) return null;

  // 2) Read bytes via Overwolf IO
  const bin = await new Promise<overwolf.io.ReadBinaryFileResult>((resolve) =>
    overwolf.io.readBinaryFile(shot.path, {} as any, resolve)
  );
  if (!bin.success || !bin.content) {
    await safeDelete(shot.path);
    return null;
  }

  // 3) Create a Blob URL and load image
  const u8 = new Uint8Array(bin.content as unknown as number[]);
  const blob = new Blob([u8], { type: "image/png" });
  const url = URL.createObjectURL(blob);

  try {
    const img = await loadImage(url);
    const needOcr = areas.some(a => (a as OcrScanArea).type === "ocr" || (a as OcrScanArea).type === undefined);
    if (needOcr) {
      // warm the pool (lazy anyway)
      await (pool as any).init?.();
    }

    const results: OcrAreasResult = {};
    // Prepare jobs (pure-black runs immediately on main thread; OCR goes to pool).
    const jobs: Promise<void>[] = [];

    for (const area of areas) {
      if ((area as PureBlackScanArea).type === "pure-black") {
        // Run *asynchronously* to interleave with OCR jobs (non-blocking scheduling).
        jobs.push((async () => {
          const res = runPureBlack(img, area as PureBlackScanArea);
          results[(area as PureBlackScanArea).id] = res;
        })());
        continue;
      }

      // OCR job via pool
      const ocrArea = area as OcrScanArea;
      jobs.push(pool.runJob(async (worker) => {
        // Crop into a dedicated canvas to avoid contention
        const { sx, sy, sw, sh } = normalizedToPixels(ocrArea.rect, img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

        // Binarize in place
        const lumMin = ocrArea.lumMin ?? ocrArea.threshold ?? DEFAULT_LUM_MIN;
        const chromaMax = ocrArea.chromaMax ?? DEFAULT_CHROMA_MAX;
        const imgData = ctx.getImageData(0, 0, sw, sh);
        binarizeGrayOnlyInPlace(imgData, { lumMin, chromaMax });
        ctx.putImageData(imgData, 0, 0);

        // Minimize parameter churn per worker
        const desiredParams: Record<string, string> = {
          tessedit_pageseg_mode: String(ocrArea.psm ?? PSM.SPARSE_TEXT_OSD),
          tessedit_char_whitelist: ocrArea.whitelist ?? STATIC_WHITELIST,
          preserve_interword_spaces: "1",
        };
        const last = worker.__lastParams || {};
        const needsUpdate =
          last.tessedit_pageseg_mode !== desiredParams.tessedit_pageseg_mode ||
          last.tessedit_char_whitelist !== desiredParams.tessedit_char_whitelist;

        if (needsUpdate) {
          await worker.setParameters(desiredParams);
          worker.__lastParams = desiredParams;
        }

        const { data: ocr } = await worker.recognize(canvas.toDataURL("image/png"));
        const text = (ocr.text || "").trim();
        results[ocrArea.id] = { type: "ocr", text: text ? splitLines(text) : [], confidence: ocr.confidence };
      }));
    }

    // Execute with concurrency via pool + async pure-black jobs
    await Promise.all(jobs);

    return results;
  } finally {
    URL.revokeObjectURL(url);
    await safeDelete(shot.path);
  }
}

// ----- helpers -----

function normalizedToPixels(rect: NormalizedRect, imgW: number, imgH: number) {
  const sx = clamp(Math.round(rect.x * imgW), 0, imgW - 1);
  const sy = clamp(Math.round(rect.y * imgH), 0, imgH - 1);
  const sw = clamp(Math.round(rect.w * imgW), 1, imgW - sx);
  const sh = clamp(Math.round(rect.h * imgH), 1, imgH - sy);
  return { sx, sy, sw, sh };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img as HTMLImageElement);
    img.onerror = reject;
    img.src = url;
  });
}

function binarizeGrayOnlyInPlace(
  data: ImageData,
  opts: { lumMin: number; chromaMax: number }
) {
  const { lumMin, chromaMax } = opts;
  const px = data.data;

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i + 0], g = px[i + 1], b = px[i + 2];

    const maxc = Math.max(r, g, b);
    const minc = Math.min(r, g, b);
    const chroma = maxc - minc;

    // default white background
    px[i + 0] = 255;
    px[i + 1] = 255;
    px[i + 2] = 255;

    if (chroma <= chromaMax) {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      if (lum >= lumMin || (chroma <= MID_GRAY_CHROMA_MAX && lum >= MID_GRAY_LUM_MIN)) {
        px[i + 0] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 255;
      }
    }
  }
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function runPureBlack(img: HTMLImageElement, area: PureBlackScanArea): PureBlackResult {
  const {
    id,
    rects,
    blackMax = DEFAULT_BLACK_MAX,
    sampleStride = DEFAULT_SAMPLE_STRIDE,
    minMatchRatio = DEFAULT_MIN_MATCH_RATIO,
    colorDeltaMax = DEFAULT_COLOR_DELTA_MAX,
  } = area;

  let tested = 0;
  let matched = 0;
  let firstFail: PureBlackResult["firstFail"] | undefined;

  // Running mean for dominant color
  let meanR = 0, meanG = 0, meanB = 0;
  let seen = 0;

  for (const rect of rects) {
    const { sx, sy, sw, sh } = normalizedToPixels(rect, img.width, img.height);

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const data = ctx.getImageData(0, 0, sw, sh);
    const { width, height, data: px } = data;

    for (let y = 0; y < height; y += sampleStride) {
      const baseY = y * width * 4;
      for (let x = 0; x < width; x += sampleStride) {
        const i = baseY + x * 4;
        const r = px[i + 0], g = px[i + 1], b = px[i + 2], a = px[i + 3];
        tested++;

        seen++;
        meanR += (r - meanR) / seen;
        meanG += (g - meanG) / seen;
        meanB += (b - meanB) / seen;

        const isBlack = r <= blackMax && g <= blackMax && b <= blackMax;

        const dr = Math.abs(r - meanR);
        const dg = Math.abs(g - meanG);
        const db = Math.abs(b - meanB);
        const isUniform = dr <= colorDeltaMax && dg <= colorDeltaMax && db <= colorDeltaMax;

        if (isBlack || isUniform) {
          matched++;
        } else if (!firstFail) {
          firstFail = { x: clamp(sx + x, 0, img.width - 1), y: clamp(sy + y, 0, img.height - 1), r, g, b, a };
        }
      }
    }
  }

  const ratio = tested > 0 ? matched / tested : 0;
  const passed = ratio >= minMatchRatio;

  return {
    type: "pure-black",
    passed,
    ratio,
    tested,
    matched,
    dominant: { r: Math.round(meanR), g: Math.round(meanG), b: Math.round(meanB) },
    ...(firstFail ? { firstFail } : {}),
  };
}

async function safeDelete(path?: string) {
  console.log('SAFEDELETE', path);
  if (!path) return;

  const basePath = await new Promise<string>((res, rej) =>
    // @ts-expect-error
    overwolf.extensions.io.getStoragePath("pictures", _res => _res.error ? rej(_res.error) : res(_res.path))
  );
  const all = await new Promise<string[]>(res =>
    overwolf.io.dir(basePath, _res =>
      res((_res.data || []).filter(f => f.type === "file").map(f => basePath + '\\' + f.name))
    )
  );

  try {
    await Promise.all(all.map(path => new Promise<object>((resolve) =>
      // @ts-expect-error
      overwolf.extensions.io.delete("pictures", path, resolve)
    )));
  } catch {
    /* ignore cleanup errors */
  }
}
