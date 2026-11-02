// Finds the build summary screen's panels in a screenshot (ADR 0016).
// Everything else is measured relative to those panels, so any resolution, aspect ratio or crop works as long as
// the three columns of panels are whole. Reference coordinates are from a 2000×1125 capture of the screen.
import { rgbAt, type Box, type Raster } from './raster.ts';

export type PanelName = 'stats' | 'style' | 'abilities' | 'parts';

/** The panels in the reference capture. */
export const REF_PANELS = {
  stats: { x: 81, y: 139, w: 349, h: 899 },
  style: { x: 453, y: 139, w: 862, h: 462 },
  abilities: { x: 453, y: 624, w: 862, h: 415 },
  parts: { x: 1339, y: 139, w: 581, h: 899 },
} as const satisfies Record<PanelName, Box>;

export interface Layout {
  /** Screenshot pixels per reference pixel. */
  scale: number;
  panels: Record<PanelName, Box>;
  /** 0–1: how well the columns found match the screen's proportions. */
  confidence: number;
}

/** The panels' dark teal: blue and green well above red. Text, icons and the tooltip don't count. */
function isPanel(r: Raster, x: number, y: number): boolean {
  const [red, green, blue] = rgbAt(r, x, y);
  return blue - red > 25 && green - red > 20 && red < 110;
}

type Run = [start: number, end: number];

/** Index ranges where `values` stays at or above `min`, joining runs split by gaps of up to `gap` entries. */
function runs(values: readonly number[], min: number, gap: number): Run[] {
  const out: Run[] = [];
  let start = -1;
  values.forEach((v, i) => {
    if (v >= min && start < 0) start = i;
    if (start >= 0 && (v < min || i === values.length - 1)) {
      out.push([start, v < min ? i - 1 : i]);
      start = -1;
    }
  });
  const joined: Run[] = [];
  for (const run of out) {
    const last = joined.at(-1);
    if (last && run[0] - last[1] - 1 <= gap) last[1] = run[1];
    else joined.push([...run]);
  }
  return joined;
}

/** Locates the panels, or returns null when the image doesn't look like the build screen. */
export function detectLayout(r: Raster): Layout | null {
  // Sample on a coarse grid: panels are hundreds of pixels across at any sensible resolution.
  const step = Math.max(1, Math.floor(Math.min(r.width, r.height) / 400));
  const xs: number[] = [];
  const cols: number[] = [];
  for (let x = 0; x < r.width; x += step) {
    let n = 0;
    let total = 0;
    for (let y = 0; y < r.height; y += step) {
      n += isPanel(r, x, y) ? 1 : 0;
      total++;
    }
    xs.push(x);
    cols.push(n / total);
  }
  // Panels fill most of the height; the selection highlight and icons only dent them, so small gaps are joined.
  const colRuns = runs(cols, 0.35, Math.max(1, Math.round((r.width * 0.006) / step)))
    .map(([a, b]): Run => [xs[a] ?? 0, (xs[b] ?? 0) + step - 1])
    .filter(([a, b]) => b - a > r.width * 0.05);

  // Pick the three neighbouring columns whose widths best match stats : style/abilities : parts.
  const ref = [REF_PANELS.stats.w, REF_PANELS.style.w, REF_PANELS.parts.w] as const;
  let best: { at: number; error: number } | null = null;
  for (let i = 0; i + 2 < colRuns.length; i++) {
    const widths = colRuns.slice(i, i + 3).map(([a, b]) => b - a + 1);
    const k = (widths[0] ?? 0) / ref[0];
    const error = Math.max(...widths.map((w, j) => Math.abs(w / ((ref[j] ?? ref[0]) * k) - 1)));
    if (!best || error < best.error) best = { at: i, error };
  }
  if (!best || best.error > 0.25) return null;
  const [left, middle, right] = colRuns.slice(best.at, best.at + 3) as [Run, Run, Run];

  // The stats panel is one unbroken block from top to bottom, so it gives the vertical position and the scale.
  const rows: number[] = [];
  for (let y = 0; y < r.height; y++) {
    let n = 0;
    let total = 0;
    for (let x = left[0]; x <= left[1]; x += step) {
      n += isPanel(r, x, y) ? 1 : 0;
      total++;
    }
    rows.push(n / total);
  }
  const tall = runs(rows, 0.35, Math.round(r.height * 0.012)).sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
  if (!tall) return null;
  const top = tall[0];
  const scale = (tall[1] - tall[0] + 1) / REF_PANELS.stats.h;
  if (scale <= 0 || (left[1] - left[0] + 1) / scale / REF_PANELS.stats.w < 0.75) return null;

  const at = (x: number, ref: Box): Box => ({ x, y: top + (ref.y - REF_PANELS.stats.y) * scale, w: ref.w * scale, h: ref.h * scale });
  return {
    scale,
    panels: {
      stats: at(left[0], REF_PANELS.stats),
      style: at(middle[0], REF_PANELS.style),
      abilities: at(middle[0], REF_PANELS.abilities),
      parts: at(right[0], REF_PANELS.parts),
    },
    confidence: Math.max(0, 1 - best.error * 3),
  };
}

/** Maps a box in reference coordinates (anywhere inside `panel`) to screenshot pixels. */
export function place(layout: Layout, panel: PanelName, ref: Box): Box {
  const origin = REF_PANELS[panel];
  const p = layout.panels[panel];
  return { x: p.x + (ref.x - origin.x) * layout.scale, y: p.y + (ref.y - origin.y) * layout.scale, w: ref.w * layout.scale, h: ref.h * layout.scale };
}
