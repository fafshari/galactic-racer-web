import { describe, expect, it } from 'vitest';
import { labels, planner } from '../data/index.ts';
import type { PartId } from '../data/types.ts';
import { decodeBuild, evaluate, type Conditional, type Row } from '../engine/index.ts';
import { conditionLabel, describeRow, fieldInfo, fmt, formatValue, groupInfo, highlight, human, unitSuffix } from './format.ts';

describe('number and text helpers', () => {
  it('formats numbers like the legacy planner', () => {
    expect([fmt(2800), fmt(6030.84), fmt(0.26923), fmt(1.5), fmt(-0.1234)]).toEqual(['2800', '6030.8', '0.269', '1.5', '-0.123']);
  });

  it('attaches symbol units and spaces word units', () => {
    expect([unitSuffix(''), unitSuffix('%'), unitSuffix('×'), unitSuffix('km/h')]).toEqual(['', '%', '×', ' km/h']);
  });

  it('splits game identifiers into words', () => {
    expect(human('SurgeOngoingTopSpeedIncreaseMph')).toBe('Surge Ongoing Top Speed Increase Mph');
    expect(human('TrackedVehicleCondition')).toBe('Tracked Vehicle Condition');
  });
});

describe('formatValue', () => {
  it('shows base → value with the percent change from unconverted numbers', () => {
    expect(formatValue(40, 50, 'km/h', 1.609344)).toEqual({ kind: 'number', base: '64.4 km/h', value: '80.5 km/h', percent: '+25%', direction: 'up' });
  });

  it('shows only the change when the base is a code default', () => {
    expect(formatValue(undefined, { add: 0, mult: 0.2, mul: 1 }, '')).toEqual({ kind: 'change', text: '+20% of default', direction: 'up' });
    expect(formatValue(undefined, { add: 0, mult: 0, mul: 0.5 }, '')).toEqual({ kind: 'change', text: '×0.5', direction: 'down' });
  });

  it('shows yes/no settings', () => {
    expect(formatValue(false, true, '')).toEqual({ kind: 'toggle', base: 'false', value: 'yes' });
    expect(formatValue(undefined, false, '')).toEqual({ kind: 'toggle', base: 'default', value: 'no' });
  });
});

describe('describeRow', () => {
  const rowsFor = (parts: string[]): Row[] => evaluate(planner, { ...decodeBuild('gr2-m106475806'), parts: parts as PartId[] }).rows;

  it('uses the hand-written label, unit and tip, plus the game name', () => {
    const top = rowsFor([]).find((r) => r.field === 'HighSpeedStep');
    if (!top) throw new Error('no top speed row');
    const v = describeRow(labels, top);
    expect(v.label).toBe(fieldInfo(labels, top.cfg, top.field).label);
    expect(v.tip.at(-1)).toBe('Game name: VehicleThrustConfig.HighSpeedStep');
    expect(v.display.kind).toBe('parts');
  });

  it('shows changed curve points as a table', () => {
    const curve = rowsFor([]).map((r) => describeRow(labels, r)).find((v) => v.display.kind === 'curve');
    if (curve?.display.kind !== 'curve') throw new Error('no curve row in this build');
    expect(curve.display.changedPoints).toBeGreaterThan(0);
    expect(curve.display.points.some((p) => p.changed[0] || p.changed[1])).toBe(true);
  });

  it('falls back to the field name when there is no label', () => {
    expect(fieldInfo(labels, 'SomeConfig', 'BrandNewField').label).toBe('Brand New Field');
    expect(groupInfo(labels, 'VehicleMadeUpConfig').heading).toBe('Made Up');
  });
});

describe('conditionLabel', () => {
  it('describes what sets an effect off', () => {
    const c: Conditional = { key: 'x#0', owner: 'X', kind: 'rule', repeatable: false, requires: [{ type: 'TrackedVehicleCondition', props: { Condition: 'Vehicle.Condition.Surging' } }] };
    expect(conditionLabel(c)).toBe('Tracked Vehicle Condition: Surging');
    expect(conditionLabel({ key: 'a#t0', owner: 'A', kind: 'ability', repeatable: true })).toBe('Ability bonus (e.g. per overtake)');
  });
});

describe('highlight', () => {
  it('marks whole keywords, longest first', () => {
    expect(highlight('While Cooled, Ramjet is more powerful.', ['Ramjet', 'Cooled'])).toEqual([
      { text: 'While ', keyword: false },
      { text: 'Cooled', keyword: true },
      { text: ', ', keyword: false },
      { text: 'Ramjet', keyword: true },
      { text: ' is more powerful.', keyword: false },
    ]);
    expect(highlight('Perfect Landing grants Perfect Start', ['Perfect Landing']).filter((r) => r.keyword).map((r) => r.text)).toEqual(['Perfect Landing']);
  });

  it('does not match inside longer words', () => {
    expect(highlight('Abilities reload faster', ['Ability']).some((r) => r.keyword)).toBe(false);
  });

  it('leaves text alone without keywords', () => {
    expect(highlight('plain', [])).toEqual([{ text: 'plain', keyword: false }]);
  });
});
