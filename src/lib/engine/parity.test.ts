// Differential tests (ADR 0008): the TypeScript engine and synergy scorer must give exactly what the legacy
// planner gives, for every part, ability, favour and style, on every vehicle. tests/legacy holds the reference copies.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { planner } from '../data/index.ts';
import type { SlotId, StyleId, VehicleId } from '../data/types.ts';
import { createSynergy, type OfferKind, type SynergyBuild } from '../synergy/synergy.ts';
import { freshBuild, type Build } from './build.ts';
import { evaluate, type Evaluation } from './evaluate.ts';

interface LegacyEngine {
  evaluate: (data: unknown, build: unknown) => Omit<Evaluation, 'conditionals'> & { conditionals: { key: string; owner: string; kind: string; repeatable: boolean }[] };
}
interface LegacySynergy {
  make: (data: unknown) => {
    tagsOf: (kind: OfferKind, id: string) => { needs: Set<string>; gives: Set<string>; touches: Set<string> };
    score: (kind: OfferKind, id: string, build: SynergyBuild) => { score: number; reason: string; pay: number; trig: number };
    scoreUpgrade: (slot: string, build: SynergyBuild) => { score: number; reason: string };
    focus: (build: SynergyBuild) => { id: string; label: string; share: number }[];
  };
}
const require = createRequire(import.meta.url);
const legacyEngine = require('../../../tests/legacy/engine.cjs') as LegacyEngine;
const legacySynergy = (require('../../../tests/legacy/synergy.cjs') as LegacySynergy).make(planner);
const synergy = createSynergy(planner);

/** Compare everything except fields the port intentionally shapes differently (none affect results). */
const comparable = (r: Pick<Evaluation, 'rows' | 'power' | 'powerBonus'> & { conditionals: readonly { key: string; owner: string; kind: string; repeatable: boolean }[] }) => ({
  rows: r.rows,
  power: r.power,
  powerBonus: r.powerBonus,
  conditionals: r.conditionals.map((c) => ({ key: c.key, owner: c.owner, kind: c.kind, repeatable: c.repeatable })),
});

/** Situational effects the legacy planner never had (ability activation, blast Power per opponent; ADR 0009). */
const isNew = (c: { kind: string }): boolean => c.kind === 'active' || c.kind === 'victims';
const legacyOnly = (r: Evaluation): Evaluation => ({ ...r, conditionals: r.conditionals.filter((c) => !isNew(c)) });

/** Evaluates with both engines, first plainly and then with every legacy situational effect counted `times` times. */
function expectSame(build: Build, times: true | number): void {
  const plain = legacyOnly(evaluate(planner, build));
  expect(comparable(plain)).toEqual(comparable(legacyEngine.evaluate(planner, build)));
  const active = Object.fromEntries(plain.conditionals.map((c) => [c.key, c.repeatable ? times : true] as const));
  const counted = { ...build, active };
  expect(comparable(legacyOnly(evaluate(planner, counted)))).toEqual(comparable(legacyEngine.evaluate(planner, counted)));
}

const vehicles = planner.vehicles.map((v) => v.id);
const bare = (vehicle: VehicleId, patch: Partial<Build> = {}): Build => ({ ...freshBuild('mp'), vehicle, style: 'none' as StyleId, abilities: [], ...patch });

describe('engine matches the legacy planner', () => {
  it.each(vehicles)('every part on its own, %s', (vehicle) => {
    for (const p of planner.affixes) {
      expectSame(bare(vehicle, { parts: [p.id] }), 1);
      expectSame(bare(vehicle, { parts: [p.id] }), 3);
    }
  });

  it.each(vehicles)('every ability, favour and racer style, %s', (vehicle) => {
    for (const a of planner.abilities) expectSame(bare(vehicle, { abilities: [a.id] }), 2);
    for (const f of planner.favours) expectSame(bare(vehicle, { mode: 'campaign', favours: [f.id] }), 1);
    for (const s of planner.styles) expectSame(bare(vehicle, { style: s.id, abilities: [...s.abilities] }), 2);
  });

  it.each(vehicles)('every upgrade slot at every level, %s', (vehicle) => {
    for (const slot of planner.slots) {
      for (let lv = 0; lv <= 10; lv++) expectSame(bare(vehicle, { levels: { [slot.id]: lv } }), 1);
    }
  });

  it.each(vehicles)('everything at once: all slots 10, every part, ability and favour, %s', (vehicle) => {
    const everything = bare(vehicle, {
      mode: 'campaign',
      levels: Object.fromEntries(planner.slots.map((s) => [s.id, 10])),
      parts: planner.affixes.map((p) => p.id),
      abilities: planner.abilities.map((a) => a.id),
      favours: planner.favours.map((f) => f.id),
    });
    expectSame(everything, 1);
    expectSame(everything, 5);
  });
});

describe('synergy matches the legacy recommender', () => {
  const sorted = (s: ReadonlySet<string>): string[] => [...s].sort();
  const builds: SynergyBuild[] = planner.styles.flatMap((s) => {
    const base: SynergyBuild = { style: s.id, abilities: [...s.abilities], parts: [], levels: {} };
    // a second build with parts in it, so family upgrades and part weights are exercised
    const withParts: SynergyBuild = { ...base, parts: planner.affixes.filter((p) => p.family !== null).slice(0, 6).map((p) => p.id), levels: { Boost: 4 } as Partial<Record<SlotId, number>> };
    return [base, withParts];
  });

  it('tags every part, ability and trait the same way', () => {
    const items: [OfferKind, string][] = [
      ...planner.affixes.map((p) => ['part', p.id] as [OfferKind, string]),
      ...planner.abilities.map((a) => ['ability', a.id] as [OfferKind, string]),
      ...Object.keys(planner.traits).map((t) => ['trait', t] as [OfferKind, string]),
    ];
    for (const [kind, id] of items) {
      const a = synergy.tagsOf(kind, id);
      const b = legacySynergy.tagsOf(kind, id);
      expect([sorted(a.needs), sorted(a.gives), sorted(a.touches)]).toEqual([sorted(b.needs), sorted(b.gives), sorted(b.touches)]);
    }
  });

  it('scores every part and ability the same for every racer style', () => {
    for (const b of builds) {
      for (const p of planner.affixes) expect(synergy.score('part', p.id, b)).toEqual(legacySynergy.score('part', p.id, b));
      for (const a of planner.abilities) expect(synergy.score('ability', a.id, b)).toEqual(legacySynergy.score('ability', a.id, b));
    }
  });

  it('gives the same focus and upgrade advice', () => {
    for (const b of builds) {
      expect(synergy.focus(b)).toEqual(legacySynergy.focus(b));
      for (const s of planner.slots) expect(synergy.scoreUpgrade(s.id, b)).toEqual(legacySynergy.scoreUpgrade(s.id, b));
    }
  });
});
