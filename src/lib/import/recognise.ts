// Reads a screenshot of the game's build summary screen into a build (ADR 0016).
// Text is read by an injected OCR function (tesseract.js in the browser and in tests) and matched against the
// game's names; stat levels are counted from the pips. Every reading carries a confidence so the UI can ask the
// player to check the doubtful ones.
import { planner } from '../data/index.ts';
import type { AbilityId, Part, PartId, PlannerData, SlotId, Style, StyleId, VehicleId } from '../data/types.ts';
import { abilityAllowed, evaluate, freshBuild, partAllowed, speeds, toKmh, type Build } from '../engine/index.ts';
import { addPart, familyKey, familyName, maxAbilities } from '../planner/actions.ts';
import { detectLayout, place, type Layout, type PanelName } from './layout.ts';
import { confidenceOf, normalise, rank, similarity, type Scored } from './match.ts';
import { lumaAt, lumaStats, textCrop, textLine, type Box, type Raster } from './raster.ts';

/** `line`: one line of text. `number`: digits and slashes only. */
export type OcrMode = 'line' | 'number';
/** Reads the text in a prepared crop (dark text on white). */
export type Ocr = (image: Raster, mode: OcrMode) => Promise<string>;

/** Readings at or above this confidence are applied without asking. */
export const CONFIDENT = 0.8;

interface ItemReading<K extends string, Id extends string> {
  kind: K;
  /** Slot number on the screen, from 0. */
  index: number;
  /** What OCR read. */
  text: string;
  /** The recognised item, or null for an empty slot (or nothing recognised). */
  id: Id | null;
  confidence: number;
  /** Other likely items, best first, for the review step. */
  alternatives: Id[];
  /** Why the reading is doubtful, when there's a specific reason. */
  note?: string;
}

export type VehicleReading = ItemReading<'vehicle', VehicleId>;
export type StyleReading = ItemReading<'style', StyleId>;
export type AbilityReading = ItemReading<'ability', AbilityId>;
export type PartReading = ItemReading<'part', PartId>;
export interface LevelReading {
  kind: 'level';
  slot: SlotId;
  level: number;
  confidence: number;
}
export type Reading = VehicleReading | StyleReading | AbilityReading | PartReading | LevelReading;

export interface ScreenshotReading {
  readings: Reading[];
  /** How well the screenshot matched the screen's layout, 0–1. */
  layoutConfidence: number;
  /** The top speed printed on the screen (km/h), if it could be read. */
  shownSpeed: number | null;
}

export class ScreenshotError extends Error {
  override name = 'ScreenshotError';
}

// ---- where things are, in reference coordinates (layout.ts) -------------------------------------------------
// Text boxes are generous: the first line of text inside each is found from the pixels.
const VEHICLE_NAME: Box = { x: 95, y: 205, w: 335, h: 45 };
const SPEED: Box = { x: 290, y: 252, w: 125, h: 40 };
const STYLE_NAME: Box = { x: 470, y: 196, w: 830, h: 40 };
const TRAIT_NAMES: Box[] = [0, 1, 2, 3].map((k) => ({ x: 478, y: 254 + 83 * k, w: 820, h: 36 }));
const ABILITY_SLOTS: { name: Box; icon: Box }[] = [
  [522, 748],
  [938, 748],
  [522, 858],
  [938, 858],
].map(([cx = 0, cy = 0]) => ({ name: { x: cx + 48, y: cy - 36, w: 300, h: 42 }, icon: { x: cx - 26, y: cy - 26, w: 52, h: 52 } }));
const PART_COUNT: Box = { x: 1835, y: 165, w: 80, h: 40 };
/** Part cards: the title sits higher when the description takes two lines, so its line is found per card. */
const PART_ROW = { first: 220, pitch: 121, height: 100, bottom: 1038 };
const PIP_ROWS = [333, 390, 448, 505, 562, 620];
const PIP_XS = [182, 202, 222, 244, 264, 284, 304, 326, 346, 366];
const PIP_BACKGROUND_X = 160;
/**
 * Heights of text handed to OCR, in pixels (see textCrop). Tesseract sometimes returns nothing for this bold display
 * font at one size and reads it perfectly at another, so an empty read is retried at the next size.
 */
const TEXT_HEIGHTS = [26, 22, 32];

const RARITY_DOTS: Record<Part['rarity'], number | null> = { Common: 1, Rare: 2, Epic: 3, Legendary: 4, Faulty: null };

// ---- pixels ---------------------------------------------------------------------------------------------------
async function readText(image: Raster, layout: Layout, panel: PanelName, ref: Box, ocr: Ocr, mode: OcrMode = 'line'): Promise<string> {
  const line = textLine(image, place(layout, panel, ref), 12 * layout.scale);
  if (!line) return '';
  for (const height of TEXT_HEIGHTS) {
    const text = (await ocr(textCrop(image, line, height), mode)).replace(/\s+/g, ' ').trim();
    if (text.replace(/[^A-Za-z0-9]/g, '').length >= 2) return text;
  }
  return '';
}

/** Lit pips per stat row. A pip is lit when it's much brighter than the row behind it. */
function readLevels(image: Raster, layout: Layout, slots: readonly SlotId[]): LevelReading[] {
  const s = layout.scale;
  const r = Math.max(1, 3 * s);
  return slots.map((slot, row) => {
    const y = PIP_ROWS[row] ?? 0;
    const at = (x: number): Box => {
      const c = place(layout, 'stats', { x, y, w: 0, h: 0 });
      return { x: c.x - r, y: c.y - r, w: 2 * r + 1, h: 2 * r + 1 };
    };
    const bg = lumaStats(image, at(PIP_BACKGROUND_X)).mean;
    const threshold = bg + 0.45 * (255 - bg);
    const values = PIP_XS.map((x) => lumaStats(image, at(x)).mean);
    const lit = values.map((v) => v > threshold);
    const level = lit.filter(Boolean).length;
    // Lit pips always run from the left; anything else means the row wasn't read properly.
    const contiguous = lit.every((on, i) => on === i < level);
    const clearest = Math.min(...values.map((v) => Math.min(1, Math.abs(v - threshold) / 35)));
    return { kind: 'level', slot, level, confidence: contiguous ? clearest : clearest * 0.4 };
  });
}

/** True when a slot's icon area has an icon in it rather than a flat placeholder. */
function hasIcon(image: Raster, box: Box): boolean {
  return lumaStats(image, box, Math.max(1, box.w / 24)).sd > 25;
}

/** Share of a box covered by the hover tooltip's near-black. */
function tooltipCover(image: Raster, box: Box): number {
  let dark = 0;
  let n = 0;
  const step = Math.max(1, box.w / 40);
  for (let y = box.y; y < box.y + box.h; y += step) {
    for (let x = box.x; x < box.x + box.w; x += step) {
      n++;
      if (lumaAt(image, x, y) < 45) dark++;
    }
  }
  return n === 0 ? 0 : dark / n;
}

/** Dark dots under a part's icon: the game's rarity marker (one for Common up to four for Legendary). */
function rarityDots(image: Raster, layout: Layout, top: number): number | null {
  const s = layout.scale;
  const white = lumaStats(image, place(layout, 'parts', { x: 1380, y: top + 71, w: 8, h: 6 })).max;
  if (white < 150) return null;
  let n = 0;
  for (let k = 0; k < 4; k++) {
    const c = place(layout, 'parts', { x: 1394.5 + 7.5 * k, y: top + 74, w: 0, h: 0 });
    const d = Math.max(1, 1.5 * s);
    if (lumaStats(image, { x: c.x - d, y: c.y - d, w: 2 * d, h: 2 * d }).min < white * 0.6) n++;
    else break;
  }
  return n;
}

// ---- matching -------------------------------------------------------------------------------------------------
function itemReading<K extends string, T extends { id: string; name: string }>(
  kind: K,
  index: number,
  text: string,
  ranked: Scored<T>[],
): ItemReading<K, T['id']> {
  const confidence = confidenceOf(ranked);
  const top = ranked[0];
  return {
    kind,
    index,
    text,
    id: top && confidence > 0 ? top.item.id : null,
    confidence,
    alternatives: ranked.slice(top && confidence > 0 ? 1 : 0, 6).map((x) => x.item.id),
  };
}

const NUMERAL = /\s+(?:I|II|III|IV|V)$/;
const numeralOf = (name: string): string => NUMERAL.exec(normalise(name))?.[0].trim() ?? '';

/**
 * A part is its family's name plus a rarity. OCR reads the family name well but often garbles the numeral in this
 * font ("III" comes back as "Ill", "Ii", "lll"), while the rarity dots under the icon are crisp. So the family comes
 * from the name and the member from the dots; the numeral only cross-checks, or decides when the dots can't be read.
 */
function readPart(data: PlannerData, index: number, text: string, dots: number | null, allowed: readonly Part[]): PartReading {
  const base = normalise(text).replace(NUMERAL, '');
  const families = new Map<string, Part[]>();
  for (const p of allowed) {
    const k = familyKey(p);
    families.set(k, [...(families.get(k) ?? []), p]);
  }
  const ranked = rank(base, [...families.values()], (fam) => (fam[0] ? familyName(data, fam[0]) : ''));
  const confidence = confidenceOf(ranked);
  const family = confidence > 0 ? ranked[0]?.item : undefined;
  if (!family) return { kind: 'part', index, text, id: null, confidence: 0, alternatives: ranked.slice(0, 5).flatMap((x) => x.item.map((p) => p.id)).slice(0, 8) };

  const byDots =
    dots === null || dots === 0
      ? undefined
      : (family.find((p) => p.tier === dots) ?? (family.length === 1 ? undefined : family.find((p) => RARITY_DOTS[p.rarity] === dots)));
  const byName = rank(text, family, (p) => p.name)[0]?.item;
  const pick = family.length === 1 ? family[0] : (byDots ?? byName);
  if (!pick) return { kind: 'part', index, text, id: null, confidence: 0, alternatives: family.map((p) => p.id) };
  const numeral = numeralOf(text);
  // Dots and numeral agreeing is certain; dots alone are trusted a little less; the numeral alone is a guess.
  const sureness = family.length === 1 || (byDots && numeral === numeralOf(pick.name)) ? 1 : byDots ? 0.85 : 0.6;
  return {
    kind: 'part',
    index,
    text,
    id: pick.id,
    confidence: confidence * sureness,
    alternatives: [...family.filter((p) => p !== pick), ...ranked.slice(1, 3).flatMap((x) => x.item)].map((p) => p.id),
  };
}

/** A style is its name plus its traits: Campaign ranks and the Multiplayer version share a name. */
function rankStyles(data: PlannerData, name: string, traitLines: readonly string[]): Scored<Style>[] {
  const lines = traitLines.filter((l) => normalise(l).length > 2);
  const allTraits = Object.values(data.traits);
  const isTrait = (line: string): boolean => allTraits.some((t) => similarity(line, t.name) >= 0.75);
  return data.styles
    .map((style) => {
      const names = style.traits.map((t) => data.traits[t]?.name ?? '');
      const matched = names.filter((n) => lines.some((l) => similarity(l, n) >= 0.75)).length;
      const extra = lines.filter((l) => isTrait(l) && !names.some((n) => similarity(l, n) >= 0.75)).length;
      const traitScore = names.length + extra === 0 ? 1 : matched / (names.length + extra);
      return { item: style, score: 0.5 * similarity(name, style.name) + 0.5 * traitScore };
    })
    .sort((a, b) => b.score - a.score);
}

// ---- the whole screen -----------------------------------------------------------------------------------------
export async function readScreenshot(image: Raster, ocr: Ocr, data: PlannerData = planner): Promise<ScreenshotReading> {
  const layout = detectLayout(image);
  if (!layout) throw new ScreenshotError("That doesn't look like the game's build screen. Take the screenshot on the Build screen, with the whole window in view.");

  const vehicleText = await readText(image, layout, 'stats', VEHICLE_NAME, ocr);
  const speedText = await readText(image, layout, 'stats', SPEED, ocr, 'number');
  const styleText = await readText(image, layout, 'style', STYLE_NAME, ocr);
  const traitTexts: string[] = [];
  for (const box of TRAIT_NAMES) traitTexts.push(await readText(image, layout, 'style', box, ocr));

  const styleRanked = rankStyles(data, styleText, traitTexts);
  const style = itemReading('style', 0, [styleText, ...traitTexts.filter((t) => t)].join(' · '), styleRanked);
  const mode = data.styles.find((s) => s.id === style.id)?.mode ?? 'mp';

  const vehicles = data.vehicles.filter((v) => data.meta.modes[mode].vehicles.includes(v.id));
  const vehicle = itemReading('vehicle', 0, vehicleText, rank(vehicleText, vehicles, (v) => v.name));

  const abilities: AbilityReading[] = [];
  const allowedAbilities = data.abilities.filter((a) => abilityAllowed(a, mode));
  for (const [index, slot] of ABILITY_SLOTS.entries()) {
    if (!hasIcon(image, place(layout, 'abilities', slot.icon))) {
      abilities.push({ kind: 'ability', index, text: '', id: null, confidence: 1, alternatives: [] });
      continue;
    }
    const text = await readText(image, layout, 'abilities', slot.name, ocr);
    abilities.push(itemReading('ability', index, text, rank(text, allowedAbilities, (a) => a.name)));
  }

  // The panel header says how many parts are installed ("4/4"); without it, every card with an icon counts.
  const count = /(\d+)\s*\/\s*\d+/.exec(await readText(image, layout, 'parts', PART_COUNT, ocr, 'number'));
  const installed = count ? Number(count[1]) : null;
  const parts: PartReading[] = [];
  const allowedParts = data.affixes.filter((p) => partAllowed(p, mode));
  for (let index = 0; PART_ROW.first + PART_ROW.pitch * index + PART_ROW.height <= PART_ROW.bottom; index++) {
    if (installed !== null && index >= installed) break;
    const top = PART_ROW.first + PART_ROW.pitch * index;
    const row = place(layout, 'parts', { x: 1365, y: top, w: 525, h: PART_ROW.height });
    if (tooltipCover(image, row) > 0.2) {
      parts.push({
        kind: 'part',
        index,
        text: '',
        id: null,
        confidence: 0,
        alternatives: [],
        note: 'Covered by a tooltip. Hide tooltips in the game (Toggle Tooltip Visibility) before taking the screenshot.',
      });
      continue;
    }
    if (!hasIcon(image, place(layout, 'parts', { x: 1378, y: top + 22, w: 56, h: 44 }))) {
      if (installed === null) break;
      continue;
    }
    const text = await readText(image, layout, 'parts', { x: 1446, y: top + 5, w: 440, h: 90 }, ocr);
    parts.push(readPart(data, index, text, rarityDots(image, layout, top), allowedParts));
  }

  const levels = readLevels(image, layout, data.slots.map((s) => s.id));
  const shown = Number.parseInt(speedText.replace(/\D/g, ''), 10);
  return {
    readings: [vehicle, style, ...abilities, ...parts, ...levels],
    layoutConfidence: layout.confidence,
    shownSpeed: Number.isFinite(shown) && shown > 0 ? shown : null,
  };
}

/** The build the readings describe. Planner rules still apply: one rarity per part family, mode limits. */
export function assembleBuild(readings: readonly Reading[], data: PlannerData = planner): Build {
  const pick = <K extends Reading['kind']>(kind: K): Extract<Reading, { kind: K }>[] =>
    readings.filter((r): r is Extract<Reading, { kind: K }> => r.kind === kind);
  const style = data.styles.find((s) => s.id === pick('style')[0]?.id);
  const mode = style?.mode ?? 'mp';
  let build: Build = freshBuild(mode, data);
  const allowedVehicles = data.meta.modes[mode].vehicles;
  const vehicle = pick('vehicle')[0]?.id;
  const abilityIds = pick('ability')
    .map((r) => r.id)
    .filter((id): id is AbilityId => id !== null)
    .filter((id, i, all) => all.indexOf(id) === i)
    .filter((id) => {
      const a = data.abilities.find((x) => x.id === id);
      return a !== undefined && abilityAllowed(a, mode);
    });
  build = {
    ...build,
    vehicle: vehicle !== undefined && vehicle !== null && allowedVehicles.includes(vehicle) ? vehicle : build.vehicle,
    style: style?.id ?? build.style,
    abilities: abilityIds.slice(0, maxAbilities(data)),
    levels: { ...build.levels, ...Object.fromEntries(pick('level').map((r) => [r.slot, r.level])) },
  };
  for (const r of pick('part')) if (r.id !== null) build = addPart(data, build, r.id);
  return build;
}

/** The build's top speed in km/h, rounded like the game's display, to compare with the screenshot's. */
export function topSpeedKmh(build: Build, data: PlannerData = planner): number {
  return Math.round(toKmh(speeds(data, build, evaluate(data, build)).top));
}

/** Readings the player should check before applying. */
export const doubtful = (readings: readonly Reading[]): Reading[] => readings.filter((r) => r.confidence < CONFIDENT);

