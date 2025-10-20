// area-ocr.ts
import { createWorker, createScheduler, PSM, Scheduler, Worker } from "tesseract.js";

/* ---------------- Shared constants (unchanged) ---------------- */

const STATIC_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_/() .,|";

// --- defaults you can tweak ---
const DEFAULT_LUM_MIN = 200;
const DEFAULT_CHROMA_MAX = 18;
const MID_GRAY_LUM_MIN = 150;
const MID_GRAY_CHROMA_MAX = 10;

// --- NEW defaults for the edge-uniform detector ---
const DEFAULT_BLACK_MAX = 12;
const DEFAULT_SAMPLE_STRIDE = 2;
const DEFAULT_MIN_MATCH_RATIO = 0.98;
const DEFAULT_COLOR_DELTA_MAX = 8;

/* ---------------- NEW: Native Tesseract scheduler ---------------- */

let scheduler: Scheduler | null = null;
let schedulerInitPromise: Promise<void> | null = null;

const WORKER_COUNT = Math.max(2, Math.min(3, (navigator.hardwareConcurrency || 4) - 1));

async function ensureScheduler() {
  if (schedulerInitPromise) return schedulerInitPromise;
  scheduler = createScheduler();
  schedulerInitPromise = (async () => {
    // Create N workers and add to scheduler
    await Promise.all(
      Array.from({ length: WORKER_COUNT }).map(async () => {
        // NEW: set language & OEM at creation (v5+ API)
        const w = (await createWorker("eng")) as Worker;
        // Light global defaults — per-job overrides still applied below
        await w.setParameters({
          // OSD is expensive; turn it off by default
          tessedit_pageseg_mode: PSM.SPARSE_TEXT,
          preserve_interword_spaces: "1",
          tessedit_char_whitelist: STATIC_WHITELIST,
          // Speed trick (works on modern Tesseract; ignored if unavailable)
          // Avoids trying both inversion polarities
          tessedit_do_invert: "0",
        });
        scheduler!.addWorker(w);
      })
    );
  })();
  return schedulerInitPromise;
}

export async function destroyOcrScheduler() {
  if (!scheduler) return;
  await scheduler.terminate();
  scheduler = null;
  schedulerInitPromise = null;
}

/* ---------------- Public types (unchanged) ---------------- */

export type NormalizedRect = { x: number; y: number; w: number; h: number };

export type ScanArea = {
  id: string;
  rect: NormalizedRect;
  threshold?: number;
  psm?: PSM;
  whitelist?: string;
  lumMin?: number;
  chromaMax?: number;
  canvas?: HTMLCanvasElement;
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
  canvas?: HTMLCanvasElement;
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

/* ---------------- NEW: one-shot in-memory screenshot ---------------- */

async function captureScreenshotImage(): Promise<HTMLImageElement | null> {
  const shot = await new Promise<overwolf.media.FileResult>((resolve) =>
    overwolf.media.takeScreenshot(resolve)
  );
  console.log({ shot });
  if (!shot.success || !shot.url || !shot.path) return null;

  const img = await loadImage(shot.url);
  try { await safeDelete(shot.path); } catch { }
  return img;
}

/* ---------------- Public API ---------------- */

/**
 * Captures a screenshot and OCRs multiple areas.
 * Uses native Tesseract scheduler, in-memory screenshots, and passes Canvas directly to recognize.
 */
export async function performOcrAreas(areas: AnyScanArea[]): Promise<OcrAreasResult | null> {
  // 0) Ensure running focused game
  const gi = await new Promise<overwolf.games.GetRunningGameInfoResult>((resolve) =>
    overwolf.games.getRunningGameInfo(resolve)
  );
  if (!gi || !gi.success || !gi.isRunning || !gi.isInFocus) return null;

  // 1) Grab a screenshot (fast path in memory)
  const img = await captureScreenshotImage();
  if (!img) return null;

  try {
    // 2) Warm scheduler only if any OCR areas exist
    if (areas.some(a => (a as OcrScanArea).type === "ocr" || (a as OcrScanArea).type === undefined)) {
      await ensureScheduler();
    }

    const results: OcrAreasResult = {};
    const jobs: Promise<void>[] = [];

    // --- NEW: do pure-black first; if it passes hard, we can short-circuit later in caller
    for (const area of areas) {
      if ((area as PureBlackScanArea).type === "pure-black") {
        const res = runPureBlack(img, area as PureBlackScanArea);
        results[(area as PureBlackScanArea).id] = res;
      }
    }

    for (const area of areas) {
      if ((area as PureBlackScanArea).type === "pure-black") continue; // done above

      const ocrArea = area as OcrScanArea;
      jobs.push((async () => {
        // Crop to a dedicated canvas
        const { sx, sy, sw, sh } = normalizedToPixels(ocrArea.rect, img.width, img.height);
        const canvas = ocrArea.canvas || document.createElement("canvas");
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

        // Binarize in place (fast integer luminance)
        const lumMin = ocrArea.lumMin ?? ocrArea.threshold ?? DEFAULT_LUM_MIN;
        const chromaMax = ocrArea.chromaMax ?? DEFAULT_CHROMA_MAX;
        const imgData = ctx.getImageData(0, 0, sw, sh);
        binarizeGrayOnlyInPlace(imgData, { lumMin, chromaMax });
        ctx.putImageData(imgData, 0, 0);

        // Per-job Tesseract params (avoid OSD; tighten whitelist)
        const params: Record<string, string> = {
          tessedit_pageseg_mode: String(ocrArea.psm ?? PSM.SPARSE_TEXT),
          tessedit_char_whitelist: ocrArea.whitelist ?? STATIC_WHITELIST,
          preserve_interword_spaces: "1",
          // Hint to skip inversion if possible
          tessedit_do_invert: "0",
        };

        // Numbers-only boost for bloodpoints
        if (ocrArea.id === "bloodpoints") {
          params.classify_bln_numeric_mode = "1";
        }

        // IMPORTANT: pass Canvas directly — no base64 re-encode
        const blob = await canvasToBlob(canvas);               // NEW
        const { data: ocr } = await scheduler!.addJob("recognize", blob, params);

        const text = (ocr.text || "").trim();
        results[ocrArea.id] = { type: "ocr", text: text ? splitLines(text) : [], confidence: ocr.confidence };
      })());
    }

    await Promise.all(jobs);
    return results;
  } finally {
    // No file cleanup needed for in-memory screenshots
  }
}

/**
 * NEW: Run OCR on a *given* image (used by the short-circuit caller to avoid re-screenshotting).
 */
export async function performOcrAreasOnImage(img: HTMLImageElement, areas: AnyScanArea[]): Promise<OcrAreasResult> {
  const results: OcrAreasResult = {};
  // @ts-expect-error
  if (areas.some(a => (a as OcrScanArea).type !== "pure-black")) await ensureScheduler();

  const jobs: Promise<void>[] = [];
  for (const area of areas) {
    if ((area as PureBlackScanArea).type === "pure-black") {
      results[(area as PureBlackScanArea).id] = runPureBlack(img, area as PureBlackScanArea);
      continue;
    }

    const ocrArea = area as OcrScanArea;
    jobs.push((async () => {
      const { sx, sy, sw, sh } = normalizedToPixels(ocrArea.rect, img.width, img.height);
      const canvas = ocrArea.canvas || document.createElement("canvas");
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const lumMin = ocrArea.lumMin ?? ocrArea.threshold ?? DEFAULT_LUM_MIN;
      const chromaMax = ocrArea.chromaMax ?? DEFAULT_CHROMA_MAX;
      const imgData = ctx.getImageData(0, 0, sw, sh);
      binarizeGrayOnlyInPlace(imgData, { lumMin, chromaMax });
      ctx.putImageData(imgData, 0, 0);

      const params: Record<string, string> = {
        tessedit_pageseg_mode: String(ocrArea.psm ?? PSM.SPARSE_TEXT),
        tessedit_char_whitelist: ocrArea.whitelist ?? STATIC_WHITELIST,
        preserve_interword_spaces: "1",
        tessedit_do_invert: "0",
      };
      if (ocrArea.id === "bloodpoints") {
        params.classify_bln_numeric_mode = "1";
      }

      const blob = await canvasToBlob(canvas);               // NEW
      const { data: ocr } = await scheduler!.addJob("recognize", blob, params);

      const text = (ocr.text || "").trim();
      results[ocrArea.id] = { type: "ocr", text: text ? splitLines(text) : [], confidence: ocr.confidence };
    })());
  }
  await Promise.all(jobs);
  return results;
}

/* ---------------- helpers (mostly unchanged; faster luminance) ---------------- */

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}

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

// CHANGED: integer luminance math; avoids a few FP ops inside the hot loop
function binarizeGrayOnlyInPlace(
  data: ImageData,
  opts: { lumMin: number; chromaMax: number }
) {
  const { lumMin, chromaMax } = opts;
  const px = data.data;

  // Pre-scale luminance threshold into same fixed-point domain (sum of weights = 255)
  const lumMinScaled = lumMin * 255;

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];

    const maxc = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const minc = r < g ? (r < b ? r : b) : (g < b ? g : b);
    const chroma = maxc - minc;

    // default white
    px[i] = 255; px[i + 1] = 255; px[i + 2] = 255;

    if (chroma <= chromaMax) {
      // integer luminance: 0.2126,0.7152,0.0722 ~= 54,183,18 over 255
      const lumScaled = 54 * r + 183 * g + 18 * b;

      if (lumScaled >= lumMinScaled || (chroma <= MID_GRAY_CHROMA_MAX && lumScaled >= MID_GRAY_LUM_MIN * 255)) {
        px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 255;
      }
    }
  }
}

function splitLines(text: string): string[] {
  return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/* ---------------- pure-black (unchanged) ---------------- */

function runPureBlack(img: HTMLImageElement, area: PureBlackScanArea): PureBlackResult {
  const {
    rects,
    blackMax = DEFAULT_BLACK_MAX,
    sampleStride = DEFAULT_SAMPLE_STRIDE,
    minMatchRatio = DEFAULT_MIN_MATCH_RATIO,
    colorDeltaMax = DEFAULT_COLOR_DELTA_MAX,
    canvas: existingCanvas
  } = area;

  let tested = 0, matched = 0;
  let firstFail: PureBlackResult["firstFail"] | undefined;
  let meanR = 0, meanG = 0, meanB = 0, seen = 0;

  for (const rect of rects) {
    const { sx, sy, sw, sh } = normalizedToPixels(rect, img.width, img.height);

    const canvas = existingCanvas || document.createElement("canvas");
    canvas.width = sw; canvas.height = sh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const { width, height, data: px } = ctx.getImageData(0, 0, sw, sh);

    for (let y = 0; y < height; y += sampleStride) {
      const baseY = y * width * 4;
      for (let x = 0; x < width; x += sampleStride) {
        const i = baseY + x * 4;
        const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
        tested++;

        seen++;
        meanR += (r - meanR) / seen;
        meanG += (g - meanG) / seen;
        meanB += (b - meanB) / seen;

        const isBlack = r <= blackMax && g <= blackMax && b <= blackMax;
        const dr = Math.abs(r - meanR), dg = Math.abs(g - meanG), db = Math.abs(b - meanB);
        const isUniform = dr <= colorDeltaMax && dg <= colorDeltaMax && db <= colorDeltaMax;

        if (isBlack || isUniform) matched++;
        else if (!firstFail) firstFail = { x: clamp(sx + x, 0, img.width - 1), y: clamp(sy + y, 0, img.height - 1), r, g, b, a };
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

/* ---------------- cleanup ---------------- */

async function safeDelete(path?: string) {
  if (!path) return;
  try {
    const basePath = await new Promise<string>((res, rej) =>
      // @ts-expect-error
      overwolf.extensions.io.getStoragePath("pictures", _res => _res.error ? rej(_res.error) : res(_res.path))
    );
    const all = await new Promise<string[]>(res =>
      overwolf.io.dir(basePath, _res =>
        res((_res.data || []).filter(f => f.type === "file").map(f => basePath + "\\" + f.name))
      )
    );
    await Promise.all(all.map(p => new Promise<object>((resolve) =>
      // @ts-expect-error
      overwolf.extensions.io.delete("pictures", p, resolve)
    )));
  } catch { /* ignore */ }
}
