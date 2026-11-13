// Turns a build into the tune operations the game would apply, then applies them to the vehicle's base configs.
// Ported from the legacy engine.js (ADR 0008); tests/engine prove the results match it.
import type { ConfigValue, PlannerData, Requirement, Effect, Rule, TuneOp, TunesetId } from '../data/types.ts';
import type { Build } from './build.ts';
import { cellBase, combine, contributions, type Cell, type CellValue, type Contribution } from './ops.ts';

/** A situational effect the player can count, shown in "Situational effects". */
export interface Conditional {
  key: string;
  /** Display name of what grants it, e.g. "Calibrating Landings I" or "In the Zone (trait)". */
  owner: string;
  desc?: string;
  /**
   * rule: a whole rule's tunesets; effect: one effect inside a rule; ability: an ability's own tunesets;
   * active: what an ability does to your vehicle while it's active; victims: a blast's Power per opponent hit.
   */
  kind: 'rule' | 'effect' | 'ability' | 'active' | 'victims';
  requires?: readonly Requirement[];
  effect?: Effect;
  /** Counted per trigger (a number) rather than on/off. */
  repeatable: boolean;
  /** Counted in seconds of something (e.g. "airborne"): it stacks once per second spent doing it. */
  perSecond?: string;
  /** Power it adds each time it's counted, when it isn't in a tuneset (a blast's Power per opponent hit). */
  power?: number;
}

/** What a "time spent doing X" requirement times, e.g. "airborne" from `...TrackedVehicleAirborneRequirementConfig_0`. */
function timedActivity(requires: readonly Requirement[]): string | undefined {
  for (const q of requires) {
    if (q.type !== 'TimeSpendPerformingNested') continue;
    const nested = q.props.NestedRequirement;
    const m = typeof nested === 'string' ? /TrackedVehicle(\w+?)RequirementConfig/.exec(nested) : null;
    return m?.[1]?.toLowerCase() ?? 'performing it';
  }
  return undefined;
}

export interface SourcedOp {
  op: TuneOp;
  steps: number;
  /** Display name of what applied it. */
  source: string;
  /** The conditional key it depends on; null when always applied. */
  cond: string | null;
}

export interface Collected {
  ops: SourcedOp[];
  conditionals: Conditional[];
  /** Power rating from upgrade levels. */
  power: number;
  /** Extra Power from counted situational "increase Speed" effects (capped so the total stays within the tuneset). */
  powerBonus: number;
}

const VEHICLE_CLASS = /^(Car|Bike|Skimmer|Plane)(?=[A-Z])/;

export function collect(data: PlannerData, build: Build): Collected {
  const ops: SourcedOp[] = [];
  const conditionals: Conditional[] = [];
  const isPlane = build.vehicle === 'Plane';
  // How many times a situational effect is counted: true = once, a number = that many triggers.
  const times = (key: string): number => {
    const a = build.active[key];
    return a === true ? 1 : Math.max(0, Math.floor(a ?? 0));
  };
  const addTuneset = (name: TunesetId, steps: number, source: string, cond: string | null, repeat = 1): void => {
    const ts = data.tunesets[name];
    if (!ts) return;
    const list = ts.stacking ? (isPlane ? ts.plane : ts.core) : ts.ops;
    const n = ts.stacking ? steps : 1;
    if (!n) return;
    for (let k = 0; k < repeat; k++) {
      for (const op of list) {
        // Shared tunesets carry Car/Bike/Skimmer/Plane-specific configs; keep only the chosen vehicle's.
        const cls = VEHICLE_CLASS.exec(op.cfg);
        if (cls && cls[1] !== build.vehicle) continue;
        ops.push({ op, steps: n, source, cond });
      }
    }
  };
  const addRules = (owner: string, ownerLabel: string, rules: readonly Rule[], desc: string): void => {
    rules.forEach((r, ri) => {
      const always = !r.requires.length;
      const key = `${owner}#${ri}`;
      // A requirement that resets after firing ("every takedown") re-arms, so its effect stacks per trigger.
      const repeatable = !r.once && (r.repeat === true || r.requires.some((q) => q.props.ResetOnCompletion === true));
      if (r.tunesets.length) {
        if (always) r.tunesets.forEach((t) => { addTuneset(t, 1, ownerLabel, null); });
        else {
          const timed = r.once ? undefined : timedActivity(r.requires);
          conditionals.push({ key, owner: ownerLabel, desc, requires: r.requires, kind: 'rule', repeatable, ...(timed ? { perSecond: timed } : {}) });
          r.tunesets.forEach((t) => { addTuneset(t, 1, ownerLabel, key, times(key)); });
        }
      }
      r.effects.forEach((e, ei) => {
        if (!e.tunesets.length) return;
        const ek = `${key}.e${ei}`;
        conditionals.push({ key: ek, owner: ownerLabel, desc, requires: r.requires, effect: e, kind: 'effect', repeatable });
        e.tunesets.forEach((t) => { addTuneset(t, 1, ownerLabel, ek, times(ek)); });
      });
    });
  };

  let power = 0;
  for (const slot of data.slots) {
    const lv = build.levels[slot.id] ?? 0;
    const L = slot.levels[lv];
    if (!L || !lv || L.tuneset === null) continue;
    power += L.power;
    addTuneset(L.tuneset, L.stat, `${slot.name} ${lv}`, null);
  }
  if (power) addTuneset(data.powerTuneset, power, `Power rating ${power}`, null);

  const style = data.styles.find((s) => s.id === build.style);
  if (style) {
    for (const t of style.traits) {
      const tr = data.traits[t];
      if (tr) addRules(t, `${tr.name} (trait)`, tr.rules, tr.desc);
    }
  }
  for (const id of build.parts) {
    const a = data.affixes.find((x) => x.id === id);
    if (a) addRules(id, a.name, a.rules, a.desc);
  }
  for (const id of build.favours) {
    const f = data.favours.find((x) => x.id === id);
    if (f) addRules(id, `${f.name} ${f.rank} (favour)`, f.rules, f.desc);
  }
  for (const id of build.abilities) {
    const ab = data.abilities.find((x) => x.id === id);
    if (!ab) continue;
    ab.tunesets.forEach((t, ti) => {
      const key = `${id}#t${ti}`;
      conditionals.push({ key, owner: ab.name, desc: ab.desc, kind: 'ability', repeatable: true });
      addTuneset(t, 1, ab.name, key, times(key));
    });
    // Not in the legacy planner (ADR 0009): what the ability does to your own vehicle while it's active, and a
    // blast's Power per opponent hit. Both only count when ticked, so an untouched build is unchanged.
    if (ab.activation !== null) {
      const key = `${id}#active`;
      conditionals.push({ key, owner: ab.name, desc: ab.desc, kind: 'active', repeatable: false });
      addTuneset(ab.activation, 1, `${ab.name} (active)`, key, times(key));
    }
    const perVictim = ab.config.PowerIncreasePerVictim;
    if (typeof perVictim === 'number' && perVictim > 0) {
      const key = `${id}#victims`;
      conditionals.push({ key, owner: ab.name, desc: ab.desc, kind: 'victims', repeatable: true, power: perVictim });
      const op: TuneOp = { op: 'IntAdd', cfg: 'VehicleGameplayConfig', field: 'Power', f: 0, i: perVictim, v2: [0, 0], v3: [0, 0, 0], pri: 0 };
      for (let k = 0; k < times(key); k++) ops.push({ op, steps: 1, source: `${ab.name} (opponents hit)`, cond: key });
    }
  }

  // "Increase Speed" effects raise the Power stat, and every Power point is a step of the power tuneset (top speed),
  // so counted situational Power gains feed it too. Power is not capped at 60: effects like Repulsormod push it higher mid-race.
  let powerBonus = 0;
  for (const { op, cond } of ops) {
    if (cond !== null && op.cfg === 'VehicleGameplayConfig' && op.field === 'Power' && op.op === 'IntAdd') powerBonus += op.i;
  }
  powerBonus = Math.max(0, powerBonus);
  if (powerBonus) addTuneset(data.powerTuneset, powerBonus, `Speed gains +${powerBonus} power`, 'power-bonus');
  return { ops, conditionals, power, powerBonus };
}

export interface CellResult {
  cell: Cell;
  base: number | boolean | undefined;
  value: CellValue;
}

/** One changed config field. */
export interface Row {
  cfg: string;
  field: string;
  base: ConfigValue | undefined;
  cells: CellResult[];
  /** False when any cell's base is missing from the data, so only the change is known. */
  known: boolean;
  sources: { source: string; kind: 'always' | 'conditional' }[];
}

export interface Evaluation {
  rows: Row[];
  conditionals: Conditional[];
  power: number;
  powerBonus: number;
}

export function evaluate(data: PlannerData, build: Build): Evaluation {
  const veh = data.vehicles.find((v) => v.id === build.vehicle);
  if (!veh) throw new Error(`unknown vehicle ${build.vehicle}`);
  const { ops, conditionals, power, powerBonus } = collect(data, build);
  const fields = new Map<string, { cfg: string; field: string; base: ConfigValue | undefined; cells: Map<Cell, Contribution[]>; sources: Map<string, 'always' | 'conditional'> }>();
  for (const { op, steps, source, cond } of ops) {
    const key = `${op.cfg}.${op.field}`;
    let f = fields.get(key);
    if (!f) {
      const base = veh.configs[op.cfg]?.[op.field] ?? data.globals[op.cfg]?.[op.field];
      f = { cfg: op.cfg, field: op.field, base, cells: new Map(), sources: new Map() };
      fields.set(key, f);
    }
    for (const [cell, c] of contributions(op, f.base, steps)) {
      const list = f.cells.get(cell);
      if (list) list.push(c);
      else f.cells.set(cell, [c]);
    }
    f.sources.set(source, cond !== null ? 'conditional' : 'always');
  }
  const rows: Row[] = [];
  for (const f of fields.values()) {
    const cells: CellResult[] = [];
    for (const [cell, parts] of f.cells) {
      const b = cellBase(f.base, cell);
      cells.push({ cell, base: b, value: combine(b, parts) });
    }
    rows.push({
      cfg: f.cfg,
      field: f.field,
      base: f.base,
      cells,
      known: cells.every((c) => typeof c.value !== 'object'),
      sources: [...f.sources].map(([source, kind]) => ({ source, kind })),
    });
  }
  rows.sort((a, b) => a.cfg.localeCompare(b.cfg) || a.field.localeCompare(b.field));
  return { rows, conditionals, power, powerBonus };
}
