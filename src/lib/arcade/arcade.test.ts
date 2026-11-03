import { describe, expect, it } from 'vitest';
import { planner } from '../data/index.ts';
import { decodeBuild, encodeBuild, evaluate, speeds } from '../engine/index.ts';
import { arcadeBuild, arcadeMode, arcadeTabs, CATEGORY_NAMES, medalTime, unlockedBy } from './arcade.ts';

const event = (name: string) => {
  const e = planner.arcade.find((x) => x.name === name);
  if (!e) throw new Error(`no Arcade event ${name}`);
  return e;
};

describe('Arcade events', () => {
  it('match the game screen: Landspeeder Ace on Jakku first, then Speeder Bike Ace once it has a medal', () => {
    const [first, second] = planner.arcade;
    expect(first?.name).toBe('Landspeeder Ace');
    expect(first?.planet).toBe('Jakku');
    expect(first?.lock).toBeNull();
    expect(first?.medals.map(medalTime)).toEqual(['01:19', '01:28', '02:44']);
    expect(second?.name).toBe('Speeder Bike Ace');
    expect(second?.planet).toBe('Lantaana');
    expect(second?.lock).toBe('Earn Bronze on Landspeeder Ace.');
    if (!second) throw new Error('no second event');
    expect(unlockedBy(planner, second)?.name).toBe('Landspeeder Ace');
  });

  it('open in the planner with no racer style, the same levels, parts and abilities, and round-trip as links', () => {
    for (const e of planner.arcade) {
      const b = arcadeBuild(planner, e);
      expect(b.style).toBeNull();
      expect(b.vehicle).toBe(e.vehicle);
      for (const [slot, level] of Object.entries(e.levels)) expect(b.levels[slot as keyof typeof b.levels]).toBe(level);
      expect(b.parts).toEqual(e.parts);
      expect([...b.abilities].sort()).toEqual([...e.abilities].sort());
      expect(decodeBuild(encodeBuild(b))).toEqual(b);
      expect(speeds(planner, b, evaluate(planner, b)).top).toBeGreaterThan(0);
    }
  });

  it('use Campaign wherever it has the vehicle (Faulty parts), and Multiplayer Tour for Podracers', () => {
    expect(arcadeMode(planner, event('Landspeeder Ace'))).toBe('campaign');
    for (const e of planner.arcade.filter((x) => x.vehicle === 'Plane')) expect(arcadeMode(planner, e)).toBe('mp');
  });

  it('group into named tabs in the game order', () => {
    const tabs = arcadeTabs(planner);
    expect(tabs[0]?.name).toBe('Field Test');
    expect(tabs.flatMap((t) => t.events)).toHaveLength(planner.arcade.length);
    for (const t of tabs) expect(CATEGORY_NAMES[t.id]).toBeDefined();
  });

  it('format medal times as the game does', () => {
    expect([medalTime(79), medalTime(164), medalTime(82.5), medalTime(5)]).toEqual(['01:19', '02:44', '01:22.50', '00:05']);
  });
});
