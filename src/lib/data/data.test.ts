import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildOrder, iconUrl, isGlyph, planner } from './index.ts';
import { PlannerData } from './schema.ts';
import { mergeOrder } from './order.ts';
import type { BuildOrder } from './order.ts';
import type { IconName, PartId } from './types.ts';
import { validateCommittedData } from './validate.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));

describe('committed game data', () => {
  it('passes every check: schema, references, labels, icon files, build order', () => {
    expect(validateCommittedData(root)).toEqual([]);
  });

  it('reports broken data instead of passing it', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'gr-data-'));
    try {
      cpSync(join(root, 'src', 'data'), join(tmp, 'src', 'data'), { recursive: true });
      cpSync(join(root, 'src', 'assets'), join(tmp, 'src', 'assets'), { recursive: true });
      const file = join(tmp, 'src', 'data', 'planner.json');
      const data = JSON.parse(readFileSync(file, 'utf8')) as { styles: { abilities: string[] }[]; affixes: { rarity: string }[] };
      data.styles[0]?.abilities.push('BP_Ability_DoesNotExist');
      if (data.affixes[0]) data.affixes[0].rarity = 'Mythic';
      writeFileSync(file, JSON.stringify(data));
      const problems = validateCommittedData(tmp);
      expect(problems.some((p) => p.includes('rarity'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('is stored normalized, so the browser-side cast matches the types', () => {
    const reparsed = PlannerData.parse(JSON.parse(JSON.stringify(planner)));
    expect(reparsed).toEqual(planner);
  });

  it('serves every icon as a URL and knows which are glyphs', () => {
    const names = [planner.vehicles[0]?.icon, planner.affixes[0]?.art].filter((n): n is IconName => n !== undefined);
    const [first] = names;
    if (first === undefined) throw new Error('fixture has no icons');
    expect(names.length).toBe(2);
    for (const n of names) expect(iconUrl(n)).toMatch(/\.webp($|\?)/);
    expect(typeof isGlyph(first)).toBe('boolean');
  });

  it('keeps the legacy build-code positions', () => {
    // A link shared from the legacy site: gr2-m1… = Multiplayer, vehicle 1.
    expect(buildOrder.vehicles[1]).toBe('Bike');
    expect(buildOrder.slots).toEqual(['Cornering', 'Acceleration', 'Resilience', 'Boost', 'AbilityUsage', 'Advanced']);
    expect(buildOrder.parts).toEqual(planner.affixes.map((p) => p.id));
  });
});

describe('mergeOrder', () => {
  // a top-level-mutable copy, so a test can swap whole arrays
  const clone = (): { -readonly [K in keyof typeof planner]: (typeof planner)[K] } => structuredClone(planner);
  const base = (): BuildOrder => mergeOrder(null, planner).order;

  it('starts from the export order when there is no order yet', () => {
    const { order, errors } = mergeOrder(null, planner);
    expect(errors).toEqual([]);
    expect(order.abilities).toEqual(planner.abilities.map((a) => a.id));
  });

  it('appends new ids at the end and never moves existing ones', () => {
    const data = clone();
    const first = data.affixes[0];
    if (!first) throw new Error('fixture has no parts');
    // a new part that sorts first alphabetically still goes last
    data.affixes = [{ ...first, id: 'AAA_New_Part' as PartId }, ...data.affixes];
    const { order, changes, errors } = mergeOrder(base(), data);
    expect(errors).toEqual([]);
    expect(order.parts.slice(0, -1)).toEqual(base().parts);
    expect(order.parts.at(-1)).toBe('AAA_New_Part');
    expect(changes).toEqual([{ kind: 'parts', added: ['AAA_New_Part'], retired: [] }]);
  });

  it('keeps removed ids as retired so later positions stay put', () => {
    const data = clone();
    const removed = data.affixes[5]?.id;
    data.affixes = data.affixes.filter((p) => p.id !== removed);
    const { order, changes } = mergeOrder(base(), data);
    expect(order.parts).toEqual(base().parts);
    expect(changes).toEqual([{ kind: 'parts', added: [], retired: [removed] }]);
  });

  it('refuses a change to the upgrade slots', () => {
    const data = clone();
    data.slots = data.slots.slice(0, 5);
    expect(mergeOrder(base(), data).errors).toContain('slots changed: the gr2 build-code format assumes the same six upgrade slots');
  });

  it('refuses more positions than a build code can address', () => {
    const order = base();
    const full: BuildOrder = { ...order, vehicles: Array.from({ length: 10 }, (_, i) => `V${i}`) };
    expect(mergeOrder(full, planner).errors).toContain('vehicles: 14 positions exceed the build-code capacity of 10');
  });
});
