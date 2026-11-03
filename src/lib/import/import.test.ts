// Screenshot import against real captures of the build screen, read with the same OCR engine the site uses.
import { fileURLToPath } from 'node:url';
import sharp, { type Sharp } from 'sharp';
import { createWorker, PSM, type Worker } from 'tesseract.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { planner } from '../data/index.ts';
import { detectLayout } from './layout.ts';
import { confidenceOf, normalise, rank, similarity } from './match.ts';
import { assembleBuild, CONFIDENT, doubtful, readScreenshot, ScreenshotError, topSpeedKmh, type Ocr, type Reading } from './recognise.ts';
import type { Raster } from './raster.ts';

const fixture = (name: string): string => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const SKIMMER = fixture('campaign-skimmer-redliner-2000x1125.webp');
// A style with three traits: its panel is shorter, so the abilities panel starts higher and its slots are taller.
// This capture's panels are also darker and less saturated than the other's.
const THREE_TRAITS = fixture('skimmer-ramjet-rider-3-traits-2000x1125.webp');

async function load(input: Sharp): Promise<Raster> {
  const { data, info } = await input.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

let worker: Worker;
const ocr: Ocr = async (image, mode) => {
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: mode === 'number' ? '0123456789/' : '' });
  const png = await sharp(Buffer.from(image.data as Uint8ClampedArray), { raw: { width: image.width, height: image.height, channels: 4 } }).png().toBuffer();
  return (await worker.recognize(png)).data.text;
};

beforeAll(async () => {
  worker = await createWorker('eng', 1, {
    langPath: fileURLToPath(new URL('../../../node_modules/@tesseract.js-data/eng/4.0.0_best_int', import.meta.url)),
    cacheMethod: 'none',
  });
}, 60_000);
afterAll(async () => {
  await worker.terminate();
});

const name = (r: Reading): string => {
  switch (r.kind) {
    case 'vehicle':
      return planner.vehicles.find((x) => x.id === r.id)?.name ?? '-';
    case 'style':
      return planner.styles.find((x) => x.id === r.id)?.id ?? '-';
    case 'ability':
      return planner.abilities.find((x) => x.id === r.id)?.name ?? '-';
    case 'part':
      return planner.affixes.find((x) => x.id === r.id)?.name ?? '-';
    case 'level':
      return `${r.slot} ${r.level}`;
  }
};

/** What the Skim Speeder screenshot shows. */
const EXPECTED = [
  'Skim Speeder',
  'CAM_Style_Ramjet_Lv3',
  'Flame Vent',
  '-',
  '-',
  '-',
  '-',
  'Ramjet Power II',
  'Ramjet Accelerator I',
  'Heat Reduction I',
  'Repulsormod III',
  'Cornering 5',
  'Acceleration 4',
  'Resilience 3',
  'Boost 9',
  'AbilityUsage 0',
  'Advanced 3',
];

describe('readScreenshot', () => {
  it('reads every slot of the Skim Speeder build, confidently', async () => {
    const result = await readScreenshot(await load(sharp(SKIMMER)), ocr);
    expect(result.readings.map(name)).toEqual(EXPECTED);
    expect(doubtful(result.readings)).toEqual([]);
    expect(result.layoutConfidence).toBeGreaterThan(0.9);
    expect(result.shownSpeed).toBe(403);
  }, 60_000);

  it('builds what the screen shows, and its top speed matches the screen', async () => {
    const result = await readScreenshot(await load(sharp(SKIMMER)), ocr);
    const build = assembleBuild(result.readings);
    expect(build).toMatchObject({
      mode: 'campaign',
      vehicle: 'Skimmer',
      style: 'CAM_Style_Ramjet_Lv3',
      abilities: ['BP_Ability_Vent_Flame'],
      parts: ['AFX_Ramjet_MorePower_v2', 'AFX_Cooled_PowerfulRamjet_v1', 'AFX_Ramjet_HeatReduction_v1', 'AFX_Landing_PerfectBoost_v3'],
      levels: { Cornering: 5, Acceleration: 4, Resilience: 3, Boost: 9, AbilityUsage: 0, Advanced: 3 },
      favours: [],
    });
    expect(Math.abs(topSpeedKmh(build) - 403)).toBeLessThanOrEqual(1);
  }, 60_000);

  it('finds the abilities wherever the style panel above pushes them, and reads the speed', async () => {
    const result = await readScreenshot(await load(sharp(THREE_TRAITS)), ocr);
    expect(result.readings.map(name)).toEqual([
      'Skim Speeder',
      'Pvp_Style_Cooling',
      'Vent II',
      '-',
      '-',
      '-',
      '-',
      'Cornering 0',
      'Acceleration 3',
      'Resilience 0',
      'Boost 0',
      'AbilityUsage 0',
      'Advanced 1',
    ]);
    // Multiplayer's Ramjet Rider and Campaign's rank 2 share their name and traits, so the style is left to check
    expect(doubtful(result.readings).map((r) => r.kind)).toEqual(['style']);
    expect(result.shownSpeed).toBe(322);
    const build = assembleBuild(result.readings);
    expect(build.abilities).toEqual(['BP_Ability_VentV2']);
    expect(topSpeedKmh(build)).toBe(322);
  }, 60_000);

  // The same screen at other sizes and framings: the panels are found wherever they are.
  it.each([
    ['1280×720', (s: Sharp) => s.resize(1280, 720)],
    ['3840×2160', (s: Sharp) => s.resize(3840, 2160)],
    ['21:9 with bars', (s: Sharp) => s.resize(2520, 1080, { fit: 'contain', background: '#e8e6df' })],
    ['16:10 with bars', (s: Sharp) => s.resize(1280, 800, { fit: 'contain', background: '#e8e6df' })],
    ['cropped to the panels', (s: Sharp) => s.extract({ left: 60, top: 120, width: 1880, height: 940 })],
  ])('reads the same build at %s', async (_, transform) => {
    const result = await readScreenshot(await load(transform(sharp(SKIMMER))), ocr);
    expect(result.readings.map(name)).toEqual(EXPECTED);
  }, 60_000);

  it('rejects an image that is not the build screen', async () => {
    const blank = await load(sharp({ create: { width: 800, height: 450, channels: 3, background: '#808080' } }));
    await expect(readScreenshot(blank, ocr)).rejects.toBeInstanceOf(ScreenshotError);
  });
});

describe('layout', () => {
  it('finds the panels and the scale', async () => {
    const layout = detectLayout(await load(sharp(SKIMMER).resize(1000, 563)));
    expect(layout?.scale).toBeCloseTo(0.5, 1);
    expect(layout?.panels.parts.x).toBeCloseTo(670, -1);
  });

  it('finds the abilities panel below a style panel of any height', async () => {
    const four = detectLayout(await load(sharp(SKIMMER)));
    const three = detectLayout(await load(sharp(THREE_TRAITS)));
    expect(four?.panels.abilities.y).toBeCloseTo(623, -1);
    expect(three?.panels.abilities.y).toBeCloseTo(540, -1);
    expect(three?.panels.abilities.h).toBeGreaterThan(four?.panels.abilities.h ?? Infinity);
  });
});

describe('matching', () => {
  it('fixes the usual roman-numeral misreads', () => {
    expect(normalise('RAMJET ACCELERATOR |')).toBe('RAMJET ACCELERATOR I');
    expect(normalise('REPULSORMOD Ill')).toBe('REPULSORMOD III');
    expect(normalise('Multi-Bolt II')).toBe('MULTI BOLT II');
    expect(similarity('HEAT REDUCTION |', 'Heat Reduction I')).toBe(1);
  });

  it('is less sure when only a numeral separates the best two names', () => {
    const parts = planner.affixes.filter((p) => p.name.startsWith('Repulsormod'));
    const ranked = rank('REPULSORMOD III', parts, (p) => p.name);
    expect(ranked[0]?.item.name).toBe('Repulsormod III');
    expect(confidenceOf(ranked)).toBeLessThan(CONFIDENT);
  });
});

describe('assembleBuild', () => {
  it('keeps one rarity per part family and drops empty slots', () => {
    const readings: Reading[] = [
      { kind: 'style', index: 0, text: '', id: 'Pvp_Style_Ramjet' as never, confidence: 1, alternatives: [] },
      { kind: 'part', index: 0, text: '', id: 'AFX_Ramjet_MorePower_v2' as never, confidence: 1, alternatives: [] },
      { kind: 'part', index: 1, text: '', id: 'AFX_Ramjet_MorePower_v3' as never, confidence: 1, alternatives: [] },
      { kind: 'part', index: 2, text: '', id: null, confidence: 0, alternatives: [] },
    ];
    const build = assembleBuild(readings);
    expect(build.mode).toBe('mp');
    expect(build.parts).toEqual(['AFX_Ramjet_MorePower_v2']);
  });
});
