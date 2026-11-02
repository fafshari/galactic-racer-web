import { describe, expect, it } from 'vitest';
import { labels, planner } from '../data/index.ts';
import type { AbilityId, FavourId, Part, PartId, StyleId, VehicleId } from '../data/types.ts';
import { decodeBuild, evaluate, freshBuild } from '../engine/index.ts';
import * as A from './actions.ts';
import { changeGroups, slotImproves } from './readout.ts';
import { restoreBuild } from './storage.ts';

const part = (name: string): Part => {
  const p = planner.affixes.find((x) => x.name === name);
  if (!p) throw new Error(`no part ${name}`);
  return p;
};
const efficiency = ['I', 'II', 'III', 'IV'].map((n) => part(`Afterburner Efficiency ${n}`));
const [effI, effII, effIV] = [efficiency[0], efficiency[1], efficiency[3]];
if (!effI || !effII || !effIV) throw new Error('fixtures missing');

describe('parts', () => {
  it('shows one picker row per family, filtered by name or effect', () => {
    const all = A.partFamilies(planner, 'mp', '');
    expect(all.filter((fam) => fam.some((p) => p.name.startsWith('Afterburner Efficiency')))).toHaveLength(1);
    expect(A.partFamilies(planner, 'mp', 'burn 200%').flat().map((p) => p.name)).toContain('Afterburner Efficiency IV');
    expect(all.flat().some((p) => p.rarity === 'Faulty')).toBe(false); // never offered in Multiplayer
  });

  it('names a family without its rarity numeral', () => {
    expect(A.familyName(planner, effII)).toBe('Afterburner Efficiency');
  });

  it('holds one rarity per family, and respects the slot limit', () => {
    let b = A.addPart(planner, freshBuild('mp'), effI.id);
    expect(A.cannotAddPart(planner, b, effIV)).toBe('in-build');
    expect(A.addPart(planner, b, effIV.id).parts).toEqual([effI.id]);
    const others = planner.affixes.filter((p) => p.family === null && p.mp.length && p.rarity !== 'Faulty').slice(0, 20);
    for (const p of others) b = A.addPart(planner, b, p.id);
    expect(b.parts).toHaveLength(A.maxParts(planner));
  });

  it('swaps rarity in place and moves its situational counts along', () => {
    const b0 = { ...A.addPart(planner, freshBuild('mp'), effI.id), active: { [`${effI.id}#0`]: 3, other: true as const } };
    const b = A.swapPart(planner, b0, 0, effIV.id);
    expect(b.parts).toEqual([effIV.id]);
    expect(b.active).toEqual({ [`${effIV.id}#0`]: 3, other: true });
    expect(A.swapPart(planner, b, 0, 'AFX_Unrelated' as PartId)).toBe(b);
  });
});

describe('abilities', () => {
  const [a1, a2, a3] = planner.abilities.filter((a) => a.mp).map((a) => a.id);
  if (!a1 || !a2 || !a3) throw new Error('fixtures missing');
  const empty = { ...freshBuild('mp'), abilities: [] as AbilityId[] };

  it('fills, replaces and never duplicates', () => {
    let b = A.placeAbility(planner, empty, a1, 0);
    b = A.placeAbility(planner, b, a2, 3);
    expect(b.abilities).toEqual([a1, a2]);
    b = A.placeAbility(planner, b, a3, 0);
    expect(b.abilities).toEqual([a3, a2]);
    expect(A.placeAbility(planner, b, a2, 0)).toBe(b);
  });
});

describe('mode and style', () => {
  it('switching mode keeps the same-named style and drops what the mode lacks', () => {
    const mp = { ...freshBuild('mp'), favours: ['x' as FavourId] };
    const c = A.setMode(planner, mp, 'campaign');
    const before = planner.styles.find((s) => s.id === mp.style);
    const after = planner.styles.find((s) => s.id === c.style);
    expect(after?.mode).toBe('campaign');
    if (planner.styles.some((s) => s.mode === 'campaign' && s.name === before?.name)) expect(after?.name).toBe(before?.name);
    expect(A.setMode(planner, c, 'mp').favours).toEqual([]);
    expect(planner.meta.modes.campaign.vehicles).toContain(c.vehicle);
  });

  it('a new style brings its starting abilities and keeps a Campaign rank', () => {
    const campaign = planner.styles.filter((s) => s.mode === 'campaign' && s.rank !== null);
    const ranked = campaign.find((s) => (s.rank ?? 0) > 1);
    const other = campaign.find((s) => s.group !== ranked?.group && s.rank === 1);
    if (!ranked || !other) throw new Error('fixtures missing');
    const b = A.setStyle(planner, { ...freshBuild('campaign'), style: ranked.id }, other.id);
    const now = planner.styles.find((s) => s.id === b.style);
    expect(now?.group).toBe(other.group);
    expect(now?.rank).toBe(ranked.rank);
    expect(b.abilities.slice(0, now?.abilities.length)).toEqual(now?.abilities);
    expect(A.ranksOf(planner, b).map((s) => s.rank)).toEqual([...A.ranksOf(planner, b).map((s) => s.rank)].sort());
  });

  it('a favour replaces another rank of the same favour, and only in Campaign', () => {
    const group = planner.favours.find((f) => planner.favours.filter((g) => g.group === f.group).length > 1)?.group;
    const [r1, r2] = planner.favours.filter((f) => f.group === group);
    if (!r1 || !r2) throw new Error('fixtures missing');
    const b = A.addFavour(planner, A.addFavour(planner, freshBuild('campaign'), r1.id), r2.id);
    expect(b.favours).toEqual([r2.id]);
    expect(A.addFavour(planner, freshBuild('mp'), r1.id).favours).toEqual([]);
  });

  it('counts and un-counts situational effects', () => {
    const b = A.setActive(A.setActive(freshBuild('mp'), 'k', 4), 'j', true);
    expect(b.active).toEqual({ k: 4, j: true });
    expect(A.setActive(b, 'k', undefined).active).toEqual({ j: true });
  });

  it('adds up power from the upgrade levels', () => {
    expect(A.powerOf(planner, decodeBuild('gr2-m106475806'))).toBe(30);
  });
});

describe('readout', () => {
  it('always lists the Afterburner and Ramjet top-speed bonuses, grouped and sorted', () => {
    const b = { ...freshBuild('mp'), abilities: [] as AbilityId[], style: 'none' as StyleId };
    const groups = changeGroups(planner, labels, b.vehicle, evaluate(planner, b));
    const pinned = groups.flatMap((g) => g.rows).filter((r) => r.pinned).map((r) => r.key);
    expect(pinned).toEqual(['VehicleAfterburnerConfig.TopSpeedIncreaseMph', 'VehicleRamjetConfig.TopSpeedIncreaseMph']);
    expect(groups.map((g) => g.heading)).toEqual([...groups.map((g) => g.heading)].sort((x, y) => x.localeCompare(y)));
  });

  it('says what each upgrade slot improves on the chosen vehicle', () => {
    const cornering = planner.slots.find((s) => s.id === 'Cornering');
    if (!cornering) throw new Error('no Cornering slot');
    expect(slotImproves(planner, labels, cornering, 'Car' as VehicleId)).toContain('Grip curve');
    // some slots only touch other vehicle classes (Advanced does nothing for a Landspeeder), but each does something somewhere
    for (const s of planner.slots) {
      const anywhere = planner.vehicles.some((v) => slotImproves(planner, labels, s, v.id).length > 0);
      expect(anywhere, s.id).toBe(true);
    }
  });
});

describe('restoreBuild', () => {
  it('restores a build saved by the legacy planner', () => {
    const saved = { ...decodeBuild('gr2-m106475806'), parts: [effII.id], active: { [`${effII.id}#0`]: true } };
    const b = restoreBuild(planner, JSON.parse(JSON.stringify(saved)));
    expect(b).toEqual(saved);
  });

  it('drops ids the data no longer has and clamps levels', () => {
    const b = restoreBuild(planner, { vehicle: 'Bike', style: planner.styles[0]?.id, levels: { Cornering: 99 }, parts: ['gone', effI.id], abilities: ['gone'] });
    expect(b?.parts).toEqual([effI.id]);
    expect(b?.abilities).toEqual([]);
    expect(Object.entries(b?.levels ?? {})).toContainEqual(['Cornering', 10]);
  });

  it('ignores anything unusable', () => {
    for (const bad of [null, 'x', 42, {}, { vehicle: 'Bike', style: 'nope' }]) expect(restoreBuild(planner, bad)).toBeNull();
  });
});
