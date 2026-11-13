import { describe, expect, it } from 'vitest';
import { planner } from '../data/index.ts';
import { decodeBuild, evaluate } from '../engine/index.ts';
import { addFavorite, allTriggered, isFavorite, removeFavorite, renameFavorite, restoreFavorites, saveFavorites, summarize } from './favorites.ts';

// Speeder Bike, Clean Racer, levels 4 7 5 8 0 6 (a real legacy link; 504 km/h with Afterburner, 589 with Ramjet).
const shared = decodeBuild('gr2-m106475806');

describe('favourites', () => {
  it('save a build with a starting name, newest first; saving it again moves it to the top', () => {
    let list = addFavorite(planner, [], shared, '', 1, 'a');
    expect(list[0]?.name).toBe('Clean Racer · Speeder Bike');
    list = addFavorite(planner, list, { ...shared, levels: { ...shared.levels, Boost: 10 } as typeof shared.levels }, 'Max boost', 2, 'b');
    expect(list.map((f) => f.name)).toEqual(['Max boost', 'Clean Racer · Speeder Bike']);
    list = addFavorite(planner, list, shared, 'Again', 3, 'c');
    expect(list.map((f) => f.name)).toEqual(['Again', 'Max boost']);
    expect(isFavorite(list, shared)).toBe(true);
  });

  it('rename (blank keeps the old name) and remove', () => {
    let list = addFavorite(planner, [], shared, 'One', 1, 'a');
    list = renameFavorite(list, 'a', '  Ramjet runner  ');
    expect(list[0]?.name).toBe('Ramjet runner');
    expect(renameFavorite(list, 'a', '   ')[0]?.name).toBe('Ramjet runner');
    expect(removeFavorite(list, 'a')).toEqual([]);
  });

  it('round-trip through storage, dropping entries that no longer decode', () => {
    const list = addFavorite(planner, [], shared, 'One', 1, 'a');
    const raw = JSON.parse(saveFavorites([...list, { id: 'x', name: 'Broken', code: 'gr2-zzzz', savedAt: 0 }])) as unknown;
    expect(restoreFavorites(planner, raw)).toEqual(list);
    expect(restoreFavorites(planner, { nonsense: true })).toEqual([]);
  });

  it('summarise a build: vehicle, style, regular abilities and the faster boost', () => {
    const [f] = addFavorite(planner, [], shared, 'One', 1, 'a');
    if (!f) throw new Error('not saved');
    const s = summarize(planner, f);
    expect(s.vehicle.name).toBe('Speeder Bike');
    expect(s.style?.name).toBe('Clean Racer');
    // Clean Racer's In the Zone (on/off) raises top speed, so the best boost beats the plain build's 589 km/h
    expect(s.boost.kind).toBe('ramjet');
    expect(s.boost.kmh).toBeGreaterThan(589);
  });

  it('save and summarise a build with no racer style', () => {
    const [f] = addFavorite(planner, [], { ...shared, style: null }, '', 1, 'a');
    if (!f) throw new Error('not saved');
    expect(f.name).toBe('No racer style · Speeder Bike');
    expect(summarize(planner, f).style).toBeNull();
  });

  it('trigger every on/off situational effect for the speed, but leave counted ones at zero', () => {
    const b = allTriggered(planner, { ...shared, parts: planner.affixes.filter((p) => ['Lethal Velocity IV', 'Afterburner Thermalizer'].includes(p.name)).map((p) => p.id) });
    const all = evaluate(planner, { ...b, active: {} }).conditionals;
    const onOff = all.filter((c) => !c.repeatable && c.perSecond === undefined).map((c) => c.key);
    const counted = all.filter((c) => c.repeatable).map((c) => c.key);
    expect(Object.keys(b.active).sort()).toEqual(onOff.sort());
    expect(counted.length).toBeGreaterThan(0);
    for (const k of counted) expect(b.active[k]).toBeUndefined();
  });
});
