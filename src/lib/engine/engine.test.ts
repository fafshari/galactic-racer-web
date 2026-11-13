// The legacy test-engine.js cases: effects whose in-game result is known from tooltips and base configs.
import { describe, expect, it } from 'vitest';
import { planner } from '../data/index.ts';
import type { PartId, SlotId, VehicleId } from '../data/types.ts';
import { freshBuild, type Build } from './build.ts';
import { evaluate, type Evaluation, type Row } from './evaluate.ts';
import { isModifier, type CellValue } from './ops.ts';
import { speeds } from './speeds.ts';

// Like the legacy tests: no racer style, so no trait effects mix in.
const build = (patch: Partial<Build>): Build => ({ ...freshBuild('mp'), style: null, abilities: [], ...patch });
const row = (r: Evaluation, key: string): Row => {
  const found = r.rows.find((x) => `${x.cfg}.${x.field}` === key);
  if (!found) throw new Error(`no row ${key}`);
  return found;
};
const first = (r: Row): CellValue => {
  const c = r.cells[0];
  if (!c) throw new Error(`row ${r.cfg}.${r.field} has no cells`);
  return c.value;
};
const asNumber = (v: CellValue): number => {
  if (typeof v !== 'number') throw new Error(`expected a number, got ${JSON.stringify(v)}`);
  return v;
};
const asModifier = (v: CellValue) => {
  if (!isModifier(v)) throw new Error(`expected a modifier, got ${JSON.stringify(v)}`);
  return v;
};
const part = (name: string): PartId => {
  const p = planner.affixes.find((a) => a.name === name);
  if (!p) throw new Error(`no part ${name}`);
  return p.id;
};
const allSlots = (level: number) => Object.fromEntries(planner.slots.map((s) => [s.id, level])) as Partial<Record<SlotId, number>>;
const vehicleBase = (id: string, cfg: string, field: string): number[] => {
  const v = planner.vehicles.find((x) => x.id === id)?.configs[cfg]?.[field];
  if (!Array.isArray(v)) throw new Error(`${id} ${cfg}.${field} is not an array`);
  return [...(v as readonly number[])];
};

describe('engine (legacy cases)', () => {
  it('Optimized Surge III: two +50% on a 15 mph base gives 30 ("100% more potent")', () => {
    const r = evaluate(planner, build({ parts: ['AFX_Condition_Surging_IncreasedPotency_v3' as PartId] }));
    expect(asNumber(first(row(r, 'VehicleThrustConfig.SurgeOngoingTopSpeedIncreaseMph')))).toBeCloseTo(30);
  });

  it('Optimized Surge I: +20% gives 18', () => {
    const r = evaluate(planner, build({ parts: ['AFX_Condition_Surging_IncreasedPotency_v1' as PartId] }));
    expect(asNumber(first(row(r, 'VehicleThrustConfig.SurgeOngoingTopSpeedIncreaseMph')))).toBeCloseTo(18);
  });

  it('Faster Attachments II: cooldown ×0.5 on a base that is a code default', () => {
    const r = evaluate(planner, build({ parts: ['AFX_Ability_FasterCooldown_v2' as PartId] }));
    expect(asModifier(first(row(r, 'AbilityTuneConfig.GlobalCooldownScale'))).mul).toBeCloseTo(0.5);
  });

  it('Reload Surge only applies once its situational effect is counted', () => {
    const id = 'AFX_Surging_FasterAbilityCooldowns' as PartId;
    const off = evaluate(planner, build({ parts: [id] }));
    expect(off.rows).toHaveLength(0);
    const key = off.conditionals[0]?.key;
    if (key === undefined) throw new Error('Reload Surge has no conditional');
    const on = evaluate(planner, build({ parts: [id], active: { [key]: true } }));
    expect(asModifier(first(row(on, 'AbilityTuneConfig.GlobalCooldownScale'))).mul).toBeCloseTo(0.4);
  });

  it('every slot at 10 gives power 60: +150 mph on HighSpeedStep for a Landspeeder', () => {
    const r = evaluate(planner, build({ levels: allSlots(10) }));
    expect(r.power).toBe(60);
    const base = vehicleBase('Car', 'VehicleThrustConfig', 'HighSpeedStep');
    expect(asNumber(first(row(r, 'VehicleThrustConfig.HighSpeedStep')))).toBeCloseTo((base[0] ?? 0) + 150);
  });

  it('the Podracer uses its own power operations: +250 mph at power 60', () => {
    const r = evaluate(planner, build({ vehicle: 'Plane' as VehicleId, levels: allSlots(10) }));
    const base = vehicleBase('Plane', 'VehicleThrustConfig', 'HighSpeedStep');
    expect(asNumber(first(row(r, 'VehicleThrustConfig.HighSpeedStep')))).toBeCloseTo((base[0] ?? 0) + 250);
  });

  it('Mad Genius 1 adds one crash to the allowance', () => {
    const fav = planner.favours.find((f) => f.name === 'Mad Genius' && f.rank === 1);
    if (!fav) throw new Error('no Mad Genius 1');
    const b = build({ mode: 'campaign', favours: [fav.id] });
    let r = evaluate(planner, b);
    if (!r.rows.length && r.conditionals.length) r = evaluate(planner, { ...b, active: Object.fromEntries(r.conditionals.map((c) => [c.key, true as const])) });
    const crash = r.rows.find((x) => x.field.includes('CrashAllowance'));
    if (!crash) throw new Error('no crash allowance row');
    const v = first(crash);
    const base = crash.cells[0]?.base;
    expect(isModifier(v) ? v.add : asNumber(v) - Number(base)).toBe(1);
  });

  it('Lethal Velocity IV stacks per takedown: 3 takedowns = +15 Power', () => {
    const id = part('Lethal Velocity IV');
    const c = evaluate(planner, build({ parts: [id] })).conditionals[0];
    if (!c) throw new Error('no conditional');
    expect(c.repeatable).toBe(true);
    const r = evaluate(planner, build({ parts: [id], active: { [c.key]: 3 } }));
    expect(asModifier(first(row(r, 'VehicleGameplayConfig.Power'))).add).toBe(15);
  });
});

describe('engine (speed procs feed Power, ADR 0009)', () => {
  it('counted "increase Speed" effects become extra power-tuneset steps', () => {
    const id = part('Calibrating Landings I');
    const c = evaluate(planner, build({ vehicle: 'Bike' as VehicleId, parts: [id] })).conditionals.find((x) => x.key.startsWith(id));
    if (!c) throw new Error('no conditional');
    const r = evaluate(planner, build({ vehicle: 'Bike' as VehicleId, parts: [id], active: { [c.key]: 4 } }));
    expect(r.powerBonus).toBe(4);
    const base = vehicleBase('Bike', 'VehicleThrustConfig', 'HighSpeedStep');
    expect(asNumber(row(r, 'VehicleThrustConfig.HighSpeedStep').cells.find((x) => x.cell === '1')?.value ?? NaN)).toBeCloseTo((base[1] ?? 0) + 10);
  });

  it('keeps adding steps past power 60 (Power is not capped)', () => {
    const id = part('Calibrating Landings I');
    const c = evaluate(planner, build({ parts: [id] })).conditionals.find((x) => x.key.startsWith(id));
    if (!c) throw new Error('no conditional');
    const r = evaluate(planner, build({ levels: allSlots(9), parts: [id], active: { [c.key]: 20 } }));
    expect(r.power).toBe(54);
    expect(r.powerBonus).toBe(20);
  });
});

describe('engine (time-counted traits)', () => {
  it('Potential Energy is counted in seconds airborne: each adds +10% Afterburner power', () => {
    const stunt = planner.styles.find((s) => s.mode === 'mp' && s.name === 'Stunt Runner');
    if (!stunt) throw new Error('no Stunt Runner style');
    const b = { ...freshBuild('mp'), style: stunt.id, abilities: [] };
    const c = evaluate(planner, b).conditionals.find((x) => x.owner === 'Potential Energy (trait)' && x.perSecond);
    if (!c) throw new Error('no per-second Potential Energy effect');
    expect(c.perSecond).toBe('airborne');
    const afterburner = (n: number): number => {
      const active = n ? { [c.key]: n } : {};
      const nb = { ...b, active };
      return speeds(planner, nb, evaluate(planner, nb)).afterburner;
    };
    const base = afterburner(0);
    expect(afterburner(1) / base).toBeCloseTo(1.1);
    expect(afterburner(5) / base).toBeCloseTo(1.5);
  });
});

describe('engine (ability speed)', () => {
  const ability = (name: string) => {
    const a = planner.abilities.find((x) => x.name === name);
    if (!a) throw new Error(`no ability ${name}`);
    return a.id;
  };
  const withAbility = (name: string, key: string, count: true | number) => {
    const b = build({ abilities: [ability(name)] });
    const c = evaluate(planner, b).conditionals.find((x) => x.key.endsWith(key));
    if (!c) throw new Error(`no ${key} effect for ${name}`);
    const counted = { ...b, active: { [c.key]: count } };
    return { c, plain: evaluate(planner, b), counted: evaluate(planner, counted), speedsOf: (r: Evaluation, bb: Build) => speeds(planner, bb, r), b, countedBuild: counted };
  };

  it('Surging Autopilot II adds +6 Power (top speed) while active', () => {
    const { c, plain, counted, speedsOf, b, countedBuild } = withAbility('Surging Autopilot II', '#active', true);
    expect(c.kind).toBe('active');
    expect(plain.powerBonus).toBe(0);
    expect(counted.powerBonus).toBe(6);
    expect(speedsOf(counted, countedBuild).top).toBeGreaterThan(speedsOf(plain, b).top);
  });

  it('plain Autopilot changes handling while active, but not speed', () => {
    const { counted } = withAbility('Autopilot', '#active', true);
    expect(counted.powerBonus).toBe(0);
    expect(counted.rows.some((r) => r.field === 'Cornering')).toBe(true);
  });

  it('Ion Blast adds +3 Power per opponent hit', () => {
    const { c, counted } = withAbility('Ion Blast', '#victims', 2);
    expect(c.repeatable).toBe(true);
    expect(c.power).toBe(3);
    expect(counted.powerBonus).toBe(6);
  });
});
