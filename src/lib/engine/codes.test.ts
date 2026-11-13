import { describe, expect, it } from 'vitest';
import { buildOrder, planner } from '../data/index.ts';
import { ORDER_CAPACITY, type BuildOrder } from '../data/order.ts';
import type { VehicleId } from '../data/types.ts';
import { fitAbilities, freshBuild, type Build } from './build.ts';
import { BuildCodeError, decodeBuild, encodeBuild, NO_STYLE } from './codes.ts';
import { evaluate } from './evaluate.ts';
import { speeds, toKmh } from './speeds.ts';

// A link shared from the live legacy planner: Speeder Bike, Clean Racer, Cornering 4 · Acceleration 7 · Resilience 5
// · Boost 8 · Battery 0 · Advanced 6, no parts or abilities.
const SHARED = 'gr2-m106475806';

/** The legacy planner's encoder, indexing straight into the data arrays (what every existing link was made with). */
function legacyEncode(b: Build): string {
  const idx = (list: readonly { id: string }[], id: string): number => list.findIndex((x) => x.id === id);
  const b36 = (n: number, w: number): string => n.toString(36).padStart(w, '0');
  const lv = planner.slots.map((s) => b36(b.levels[s.id] ?? 0, 1)).join('');
  const pt = b.parts.map((id) => b36(idx(planner.affixes, id), 2)).join('');
  const ab = b.abilities.map((id) => b36(idx(planner.abilities, id), 2)).join('');
  const fv = b.favours.map((id) => b36(idx(planner.favours, id), 2)).join('');
  return `gr2-${b.mode === 'campaign' ? 'c' : 'm'}${idx(planner.vehicles, b.vehicle)}${b36(idx(planner.styles, b.style ?? ''), 2)}${lv}.${pt}.${ab}.${fv}`.replace(/\.+$/, '');
}

const sampleBuilds = (): Build[] => {
  const mp = planner.styles.filter((s) => s.mode === 'mp');
  const camp = planner.styles.filter((s) => s.mode === 'campaign');
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const campaign = i % 2 === 1;
    const style = (campaign ? camp : mp)[i] ?? planner.styles[0];
    if (!style) throw new Error('no styles');
    return {
      ...freshBuild(campaign ? 'campaign' : 'mp'),
      vehicle: (planner.vehicles[i % 3]?.id ?? 'Car') as VehicleId,
      style: style.id,
      levels: Object.fromEntries(planner.slots.map((s, k) => [s.id, (i + k * 3) % 11])),
      parts: planner.affixes.filter((_, k) => k % (37 + i) === 0).slice(0, 10).map((p) => p.id),
      abilities: fitAbilities(planner, planner.abilities.filter((_, k) => k % (11 + i) === 0).map((a) => a.id)),
      favours: campaign ? planner.favours.filter((_, k) => k % (13 + i) === 0).map((f) => f.id) : [],
    };
  });
};

describe('build codes', () => {
  it('decodes a link shared from the legacy planner', () => {
    const b = decodeBuild(SHARED);
    expect(b.mode).toBe('mp');
    expect(b.vehicle).toBe('Bike');
    expect(b.style).toBe(planner.styles[6]?.id);
    expect(b.levels).toEqual({ Cornering: 4, Acceleration: 7, Resilience: 5, Boost: 8, AbilityUsage: 0, Advanced: 6 });
    expect([b.parts, b.abilities, b.favours]).toEqual([[], [], []]);
    expect(encodeBuild(b)).toBe(SHARED);
  });

  it('accepts links whose trailing dots a chat app kept or stripped', () => {
    for (const code of [SHARED, `${SHARED}.`, `${SHARED}...`, ` ${SHARED} `]) expect(encodeBuild(decodeBuild(code))).toBe(SHARED);
  });

  it('encodes exactly as the legacy planner did, and round-trips', () => {
    for (const b of sampleBuilds()) {
      const code = encodeBuild(b);
      expect(code).toBe(legacyEncode(b));
      expect(decodeBuild(code)).toEqual({ ...b, active: {} });
    }
  });

  it('keeps old links meaning the same after new parts are imported', () => {
    const b = sampleBuilds()[0];
    if (!b) throw new Error('no sample');
    const code = encodeBuild(b);
    const patched: BuildOrder = { ...buildOrder, parts: [...buildOrder.parts, 'AFX_Added_In_A_Patch'] };
    expect(decodeBuild(code, planner, patched)).toEqual({ ...b, active: {} });
  });

  it('skips parts the game has since removed instead of loading the wrong ones', () => {
    const removed = planner.affixes[3];
    const kept = planner.affixes[4];
    if (!removed || !kept) throw new Error('no parts');
    const code = encodeBuild({ ...freshBuild('mp'), abilities: [], parts: [removed.id, kept.id] });
    const later = { ...planner, affixes: planner.affixes.filter((p) => p.id !== removed.id) };
    expect(decodeBuild(code, later).parts).toEqual([kept.id]);
  });

  it("ignores a style from the other mode and favours outside Campaign", () => {
    const campStyle = planner.styles.find((s) => s.mode === 'campaign');
    const fav = planner.favours[0];
    if (!campStyle || !fav) throw new Error('fixtures missing');
    const code = legacyEncode({ ...freshBuild('mp'), style: campStyle.id, favours: [fav.id] });
    const b = decodeBuild(code);
    expect(b.style).toBe(freshBuild('mp').style);
    expect(b.favours).toEqual([]);
  });

  it('round-trips a build with no racer style, keeping its abilities, parts and levels', () => {
    for (const mode of ['mp', 'campaign'] as const) {
      const sample = sampleBuilds().find((b) => b.mode === mode);
      if (!sample) throw new Error('no sample');
      const b: Build = { ...sample, style: null };
      const code = encodeBuild(b);
      expect(code.slice(5, 8)).toBe(`${String(buildOrder.vehicles.indexOf(b.vehicle))}${NO_STYLE}`);
      expect(decodeBuild(code)).toEqual({ ...b, active: {} });
    }
    // a bare no-style link, as a chat app leaves it with the dots stripped
    const bare = decodeBuild('gr2-m0zz000000');
    expect([bare.style, bare.abilities, bare.parts]).toEqual([null, [], []]);
  });

  it('never gives a real style the no-style position, so old links keep decoding the same', () => {
    expect(parseInt(NO_STYLE, 36)).toBe(36 * 36 - 1);
    expect(ORDER_CAPACITY.styles).toBe(36 * 36 - 1);
    expect(buildOrder.styles.length).toBeLessThanOrEqual(ORDER_CAPACITY.styles);
  });

  it('rejects anything that is not a gr2 code', () => {
    for (const bad of ['', 'gr1-m106475806', 'gr2-x106475806', 'gr2-m1064758', 'hello']) expect(() => decodeBuild(bad)).toThrow(BuildCodeError);
  });
});

describe('speeds', () => {
  const kmh = (mph: number): number => Math.round(toKmh(mph));

  it('match what the live planner shows for the shared Speeder Bike build', () => {
    const b = decodeBuild(SHARED);
    const s = speeds(planner, b, evaluate(planner, b));
    expect(kmh(s.top)).toBe(418);
    expect(kmh(s.baseTop)).toBe(298);
    expect(kmh(s.top + s.afterburner)).toBe(504);
    expect(kmh(s.top + s.ramjet)).toBe(589);
    expect(s.ramjetKnown).toBe(true);
    expect(kmh(s.surge)).toBe(24);
    expect(kmh(s.top + s.surgeBurst)).toBe(499);
  });

  it('rise with counted Speed procs: 4 Calibrating Landings take the same build to 435 km/h', () => {
    const cl = planner.affixes.find((p) => p.name === 'Calibrating Landings I');
    if (!cl) throw new Error('no Calibrating Landings I');
    const b: Build = { ...decodeBuild(SHARED), parts: [cl.id] };
    const key = evaluate(planner, b).conditionals.find((c) => c.key.startsWith(cl.id))?.key;
    if (key === undefined) throw new Error('no conditional');
    const counted: Build = { ...b, active: { [key]: 4 } };
    expect(kmh(speeds(planner, counted, evaluate(planner, counted)).top)).toBe(435);
  });
});
