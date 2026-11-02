import { describe, expect, it } from 'vitest';
import { labels, planner } from '../data/index.ts';
import type { PartId } from '../data/types.ts';
import { decodeBuild, evaluate, freshBuild, type Conditional, type Row } from '../engine/index.ts';
import { conditionText, describeRow, fieldInfo, fmt, formatValue, groupInfo, highlight, human, unitSuffix } from './format.ts';

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

  it('uses the hand-written label, unit and tip, and nothing else in the tip', () => {
    const top = rowsFor([]).find((r) => r.field === 'HighSpeedStep');
    if (!top) throw new Error('no top speed row');
    const v = describeRow(labels, top);
    expect(v.label).toBe(fieldInfo(labels, top.cfg, top.field).label);
    expect(v.tip).toEqual([fieldInfo(labels, top.cfg, top.field).tip]);
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

describe('conditionText', () => {
  const rule = (requires: Conditional['requires']): Conditional => ({ key: 'x#0', owner: 'X', kind: 'rule', repeatable: false, ...(requires ? { requires } : {}) });

  it('says when an effect applies in plain words', () => {
    expect(conditionText(rule([{ type: 'TrackedVehicleCondition', props: { Condition: 'Vehicle.Condition.Malfunction' } }]))).toBe('System Malfunction');
    expect(conditionText(rule([{ type: 'TrackedRamjetState', props: { ActiveRamjetStates: ['CriticalWarning'] } }]))).toBe('Redlining');
    expect(conditionText(rule([{ type: 'Takedown', props: { NumberOfTakedownsNeeded: 3 } }]))).toBe('3 Takedowns');
    expect(conditionText({ key: 'a#active', owner: 'A', kind: 'active', repeatable: false })).toBe('While the ability is active');
  });

  it('leaves out requirements players would not recognise instead of showing internal names', () => {
    expect(conditionText(rule([{ type: 'VehicleLanding', props: {} }, { type: 'AfterburnerState', props: { AfterburnerEnergyThreshold: 0 } }]))).toBe('Landing');
  });

  it('tells apart the two rules of Heat Recycler', () => {
    const firebug = planner.styles.find((s) => s.mode === 'mp' && s.name === 'Firebug');
    if (!firebug) throw new Error('no Firebug style');
    const heat = evaluate(planner, { ...freshBuild('mp'), style: firebug.id, abilities: [] }).conditionals.filter((c) => c.owner === 'Heat Recycler (trait)');
    expect(heat.map(conditionText)).toEqual(['Burning', 'Burning + Ramjet ready']);
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

describe('curves', () => {
  it('say in plain sentences what moved, with a before/after chart', () => {
    const b = { ...decodeBuild('gr2-m106475806') };
    const views = evaluate(planner, b).rows.map((r) => describeRow(labels, r));
    const grip = views.find((v) => v.label === 'Grip curve')?.display;
    const ramjet = views.find((v) => v.label === 'Turning penalty with Ramjet')?.display;
    if (grip?.kind !== 'curve' || ramjet?.kind !== 'curve') throw new Error('no curves');
    expect(grip.changes[0]).toMatch(/^Grip blend reaches 0 at [\d.]+ km\/h \(was [\d.]+ km\/h\)$/);
    expect(ramjet.changes[0]).toMatch(/^At [\d.]+ km\/h: extra turn radius 25 → [\d.]+ m$/);
    expect(grip.chart.base).toHaveLength(grip.chart.value.length);
    expect(grip.explain).toContain('low-speed grip');
  });
});
