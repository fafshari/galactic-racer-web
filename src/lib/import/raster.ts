// Plain RGBA pixel buffers and the few pixel operations the screenshot reader needs (ADR 0016).
// No canvas or DOM: the browser and the tests both hand in decoded pixels.

/** Decoded image pixels, 4 bytes per pixel (RGBA), row by row. `ImageData` fits this shape. */
export interface Raster {
  readonly width: number;
  readonly height: number;
  readonly data: ArrayLike<number>;
}

/** A rectangle in pixels. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const clampInt = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)));

export function rgbAt(r: Raster, x: number, y: number): [number, number, number] {
  const i = (clampInt(y, 0, r.height - 1) * r.width + clampInt(x, 0, r.width - 1)) * 4;
  return [r.data[i] ?? 0, r.data[i + 1] ?? 0, r.data[i + 2] ?? 0];
}

export function lumaAt(r: Raster, x: number, y: number): number {
  const [red, green, blue] = rgbAt(r, x, y);
  return 0.299 * red + 0.587 * green + 0.114 * blue;
}

/** Luma statistics over a box, sampled every `step` pixels. */
export function lumaStats(r: Raster, box: Box, step = 1): { mean: number; min: number; max: number; sd: number } {
  let n = 0;
  let sum = 0;
  let sq = 0;
  let min = 255;
  let max = 0;
  const s = Math.max(1, Math.round(step));
  for (let y = Math.round(box.y); y < box.y + box.h; y += s) {
    for (let x = Math.round(box.x); x < box.x + box.w; x += s) {
      const v = lumaAt(r, x, y);
      n++;
      sum += v;
      sq += v * v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (n === 0) return { mean: 0, min: 0, max: 0, sd: 0 };
  const mean = sum / n;
  return { mean, min, max, sd: Math.sqrt(Math.max(0, sq / n - mean * mean)) };
}

/**
 * The first line of light text inside a box: rows are text when they hold some clearly bright pixels, and lines are
 * separated by at least one row with none. Lines shorter than `minHeight` (underlines, specks) are skipped.
 */
export function textLine(src: Raster, box: Box, minHeight: number): Box | null {
  const { mean, max } = lumaStats(src, box, Math.max(1, box.h / 30));
  if (max - mean < 40) return null;
  const bright = mean + 0.55 * (max - mean);
  const need = Math.max(2, box.w * 0.01);
  let start = -1;
  for (let y = Math.round(box.y); y <= box.y + box.h; y++) {
    let n = 0;
    if (y < box.y + box.h) for (let x = Math.round(box.x); x < box.x + box.w; x++) if (lumaAt(src, x, y) > bright) n++;
    if (n >= need && start < 0) start = y;
    if (n < need && start >= 0) {
      if (y - start >= minHeight) {
        const margin = Math.max(2, (y - start) * 0.15);
        return { x: box.x, y: start - margin, w: box.w, h: y - start + 2 * margin };
      }
      start = -1;
    }
  }
  return null;
}

/**
 * Cuts out a line of light-on-dark text and prepares it for OCR: greyscale, inverted to dark-on-light, contrast
 * binarised and resampled (bilinear) to `height` pixels tall, with a white margin. Tesseract reads best when text is
 * about 30 px tall; much larger and it returns nothing.
 */
export function textCrop(src: Raster, box: Box, height: number): Raster {
  const scale = height / box.h;
  const w = Math.max(1, Math.round(box.w * scale));
  const h = Math.max(1, Math.round(height));
  const grey = new Float32Array(w * h);
  let lo = 255;
  let hi = 0;
  for (let y = 0; y < h; y++) {
    const sy = box.y + (y + 0.5) / scale - 0.5;
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    for (let x = 0; x < w; x++) {
      const sx = box.x + (x + 0.5) / scale - 0.5;
      const x0 = Math.floor(sx);
      const fx = sx - x0;
      const v =
        lumaAt(src, x0, y0) * (1 - fx) * (1 - fy) +
        lumaAt(src, x0 + 1, y0) * fx * (1 - fy) +
        lumaAt(src, x0, y0 + 1) * (1 - fx) * fy +
        lumaAt(src, x0 + 1, y0 + 1) * fx * fy;
      grey[y * w + x] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  // Binarise at Otsu's threshold: OCR is far steadier on clean black-on-white than on soft edges and gradients.
  const cut = otsu(grey, lo, hi);
  const pad = Math.round(h / 3);
  const pw = w + 2 * pad;
  const ph = h + 2 * pad;
  const data = new Uint8ClampedArray(pw * ph * 4).fill(255);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((grey[y * w + x] ?? 0) <= cut) continue;
      const i = ((y + pad) * pw + x + pad) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    }
  }
  return { width: pw, height: ph, data };
}

/** The grey level that best splits the values into two classes (Otsu's method). */
function otsu(values: Float32Array, lo: number, hi: number): number {
  const bins = new Float64Array(64);
  const width = Math.max(1e-6, hi - lo) / 64;
  for (const v of values) {
    const i = Math.max(0, Math.min(63, Math.floor((v - lo) / width)));
    bins[i] = (bins[i] ?? 0) + 1;
  }
  const total = values.length;
  let sumAll = 0;
  bins.forEach((n, i) => (sumAll += n * i));
  let sumB = 0;
  let weightB = 0;
  let best = 0;
  let at = 32;
  bins.forEach((n, i) => {
    weightB += n;
    if (weightB === 0 || weightB === total) return;
    sumB += n * i;
    const meanB = sumB / weightB;
    const meanF = (sumAll - sumB) / (total - weightB);
    const between = weightB * (total - weightB) * (meanB - meanF) ** 2;
    if (between > best) {
      best = between;
      at = i;
    }
  });
  return lo + (at + 1) * width;
}
