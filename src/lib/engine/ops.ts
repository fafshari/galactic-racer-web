// Tune operations: how one game operation changes one value (ADR 0009).
//
// Operation names come straight from the game (ETuneOperations). The combination order is an assumption:
// flat adds and "multiple" adds (fractions of the base) are summed, then multipliers are applied:
//   value = (base + Σadd + base·Σmultiple) · Πmultiply      (a Set overrides everything)
import type { ConfigValue, FloatCurve, TuneOp } from '../data/types.ts';

const OP_RX = /^(FloatCurve|VectorCurve([XYZ])?|FloatArray|Vector2D|Vector|Float|Int|Bool)(Single|All)?(AddMultiple|SubtractMultiple|Add|Subtract|Multiply|SetTrue|SetFalse)$/;

export type OpType = 'FloatCurve' | 'VectorCurve' | 'FloatArray' | 'Vector2D' | 'Vector' | 'Float' | 'Int' | 'Bool';
export type OpAction = 'AddMultiple' | 'SubtractMultiple' | 'Add' | 'Subtract' | 'Multiply' | 'SetTrue' | 'SetFalse';

export interface ParsedOp {
  type: OpType;
  /** The component a vector-curve op targets (X, Y or Z); null for all components or non-vector ops. */
  comp: 'X' | 'Y' | 'Z' | null;
  /** Single: one curve key (`op.i`); All: every key; null: not a curve op. */
  scope: 'Single' | 'All' | null;
  action: OpAction;
}

export function parseOp(name: string): ParsedOp | null {
  const m = OP_RX.exec(name);
  if (!m) return null;
  return {
    type: m[1] as OpType,
    comp: (m[2] ?? null) as ParsedOp['comp'],
    scope: (m[3] ?? null) as ParsedOp['scope'],
    action: m[4] as OpAction,
  };
}

/** How a contribution combines: a flat amount, a fraction of the base, a multiplier, or an override. */
export type Contribution =
  | { kind: 'add'; amount: number }
  | { kind: 'mult'; amount: number }
  | { kind: 'mul'; amount: number }
  | { kind: 'set'; value: boolean };

function contributionOf(action: OpAction, amount: number, steps: number): Contribution {
  switch (action) {
    case 'Add':
      return { kind: 'add', amount: amount * steps };
    case 'Subtract':
      return { kind: 'add', amount: -amount * steps };
    case 'AddMultiple':
      return { kind: 'mult', amount: amount * steps };
    case 'SubtractMultiple':
      return { kind: 'mult', amount: -amount * steps };
    case 'Multiply':
      return { kind: 'mul', amount: Math.pow(amount, steps) };
    case 'SetTrue':
      return { kind: 'set', value: true };
    case 'SetFalse':
      return { kind: 'set', value: false };
  }
}

/**
 * A cell addresses one scalar inside a value: '' for a number, '0'..'2' for vector components or array entries,
 * 'k1.t' / 'k1.v' for a float curve key's time / value, 'c2.k1.v' for a vector-curve component's key.
 */
export type Cell = string;

/** A vector or array value. (The only array shape a config value has, so the guard is sound.) */
export const isNumberList = (v: ConfigValue | undefined): v is readonly number[] => Array.isArray(v);

export const isFloatCurve = (v: ConfigValue | undefined): v is FloatCurve =>
  typeof v === 'object' && !Array.isArray(v) && Array.isArray((v as { curve?: unknown }).curve);

/** The data's raw vector curves aren't decoded yet, so vector-curve keys have no base (same as the legacy engine). */
const curveKeys = (base: ConfigValue | undefined): FloatCurve['curve'] | undefined => (isFloatCurve(base) ? base.curve : undefined);

/** Expands one operation, applied `steps` times, into per-cell contributions. */
export function contributions(op: TuneOp, base: ConfigValue | undefined, steps: number): [Cell, Contribution][] {
  const p = parseOp(op.op);
  if (!p) return [];
  const out: [Cell, Contribution][] = [];
  const push = (cell: Cell, amount: number): void => {
    const c = contributionOf(p.action, amount, steps);
    if (c.kind === 'set' || amount !== 0 || p.action === 'Multiply') out.push([cell, c]);
  };
  switch (p.type) {
    case 'Float':
      push('', op.f);
      break;
    case 'Int':
      push('', op.i);
      break;
    case 'Bool':
      push('', 1);
      break;
    case 'Vector2D':
      push('0', op.v2[0]);
      push('1', op.v2[1]);
      break;
    case 'Vector':
      push('0', op.v3[0]);
      push('1', op.v3[1]);
      push('2', op.v3[2]);
      break;
    case 'FloatArray':
      push(String(op.i), op.f);
      break;
    case 'FloatCurve':
    case 'VectorCurve': {
      // X adjusts a key's input (time), Y its output (value).
      const comps: (number | null)[] = p.type === 'FloatCurve' ? [null] : p.comp ? ['XYZ'.indexOf(p.comp)] : [0, 1, 2];
      for (const c of comps) {
        const keys = c === null ? curveKeys(base) : undefined;
        const n = keys ? keys.length : p.scope === 'Single' ? op.i + 1 : 0;
        const idx = p.scope === 'Single' ? [op.i] : [...Array(n).keys()];
        const pre = c === null ? '' : `c${c}.`;
        for (const k of idx) {
          if (p.action === 'Multiply') {
            if (op.v2[0] !== 1) push(`${pre}k${k}.t`, op.v2[0]);
            if (op.v2[1] !== 1) push(`${pre}k${k}.v`, op.v2[1]);
          } else {
            if (op.v2[0]) push(`${pre}k${k}.t`, op.v2[0]);
            if (op.v2[1]) push(`${pre}k${k}.v`, op.v2[1]);
          }
        }
      }
      break;
    }
  }
  return out;
}

/** The base scalar a cell refers to, or undefined when the data doesn't have it. */
export function cellBase(base: ConfigValue | undefined, cell: Cell): number | boolean | undefined {
  if (base === undefined) return undefined;
  if (cell === '') return typeof base === 'boolean' || typeof base === 'number' ? base : undefined;
  if (isNumberList(base)) return base[Number(cell)];
  const m = /^(?:c(\d)\.)?k(\d+)\.([tv])$/.exec(cell);
  if (!m) return undefined;
  if (m[1] !== undefined) return undefined; // vector-curve keys: not decoded (see curveKeys)
  const key = curveKeys(base)?.[Number(m[2])];
  return key ? key[m[3] === 't' ? 0 : 1] : undefined;
}

/** The change itself, when the base value isn't in the data (a code default): add, fraction-of-base and multiplier. */
export interface Modifier {
  add: number;
  mult: number;
  mul: number;
}

export type CellValue = number | boolean | Modifier;

export function combine(base: number | boolean | undefined, parts: readonly Contribution[]): CellValue {
  let add = 0;
  let mult = 0;
  let mul = 1;
  let set: boolean | undefined;
  for (const c of parts) {
    if (c.kind === 'add') add += c.amount;
    else if (c.kind === 'mult') mult += c.amount;
    else if (c.kind === 'mul') mul *= c.amount;
    else set = c.value;
  }
  if (set !== undefined) return set;
  if (base === undefined) return { add, mult, mul };
  const b = Number(base); // a numeric op on a boolean field treats it as 0/1, as the legacy engine did
  return (b + add + b * mult) * mul;
}

export const isModifier = (v: CellValue): v is Modifier => typeof v === 'object';
