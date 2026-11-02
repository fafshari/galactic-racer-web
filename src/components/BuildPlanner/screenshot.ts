// Browser side of the screenshot import (ADR 0016): decodes the image and runs OCR with tesseract.js.
// The planner loads this module only when someone imports a screenshot, so none of it is in the page's bundle.
// Everything runs on the visitor's device; the OCR engine and its English data are served from this site.
import { createWorker, PSM, type Worker } from 'tesseract.js';
import coreUrl from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url';
import workerUrl from 'tesseract.js/dist/worker.min.js?url';
import { readScreenshot, ScreenshotError, type Ocr, type Raster, type ScreenshotReading } from '~/lib/import/index.ts';

/** Served by the ocr-data integration (src/integrations/ocr-data.ts, OCR_LANG_DIR). */
const LANG_DIR = '/ocr/4.0.0_best_int';
/** A read that hasn't finished by now has failed: tesseract reports some start-up failures without rejecting. */
const TIMEOUT_MS = 90_000;

let worker: Promise<Worker> | null = null;

/** One OCR worker for the page's lifetime: starting it (and fetching ~4.5 MB once, then cached) is the slow part. */
function ocrWorker(): Promise<Worker> {
  worker ??= (async () => {
    const absolute = (url: string): string => new URL(url, location.href).href;
    // The browser's HTTP cache keeps the files; tesseract's own IndexedDB cache would only store a second copy.
    return createWorker('eng', 1, { workerPath: absolute(workerUrl), corePath: absolute(coreUrl), langPath: absolute(LANG_DIR), cacheMethod: 'none' });
  })().catch((e: unknown) => {
    worker = null; // let a later attempt retry, e.g. after a network blip
    throw e;
  });
  return worker;
}

function toCanvas(image: Raster): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d')?.putImageData(new ImageData(Uint8ClampedArray.from(image.data), image.width, image.height), 0, 0);
  return canvas;
}

const ocr: Ocr = async (image, mode) => {
  const w = await ocrWorker();
  await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: mode === 'number' ? '0123456789/' : '' });
  return (await w.recognize(toCanvas(image))).data.text;
};

/** Decodes an image file into pixels. */
export async function decode(file: Blob): Promise<Raster> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new ScreenshotError("That image couldn't be opened. Paste or drop a PNG, JPEG or WebP screenshot.");
  });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is unavailable in this browser.');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Reads a screenshot of the build screen. `onstep` reports progress for the UI. */
export async function importScreenshot(file: Blob, onstep: (message: string) => void): Promise<ScreenshotReading> {
  onstep('Reading the image…');
  const image = await decode(file);
  // The OCR engine loads on the first read, after the layout check, so a wrong image fails fast.
  onstep(worker ? 'Recognising your build…' : 'Recognising your build… The first import also downloads the text reader (about 4.5 MB).');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(new Error('Reading the screenshot timed out.')); }, TIMEOUT_MS);
  });
  try {
    return await Promise.race([readScreenshot(image, ocr), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
