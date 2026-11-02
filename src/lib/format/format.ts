// Turns engine output into display-ready values (no HTML), so components stay thin and this stays testable.
// Ported from the legacy planner's readout helpers.
import { labelKey } from '../data/references.ts';
import type { Labels, Requirement } from '../data/types.ts';
import type { Conditional, Row } from '../engine/evaluate.ts';
import { isFloatCurve, isModifier, type CellValue } from '../engine/ops.ts';

/** "SurgeOngoingTopSpeed" -> "Surge Ongoing Top Speed". */
export const human = (s: string): string =>
  s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').replace(/_/g, ' ');

/** Short numbers: one decimal from 100 up, otherwise up to three. */
export const fmt = (n: number): string => (Math.abs(n) >= 100 ? n.toFixed(1).replace(/\.0$/, '') : String(+n.toFixed(3)));

/** Converted units (km/h) read best at one decimal. */
export const round1 = (x: number): number => Math.round(x * 10) / 10;

/** Unit after a number: symbols attach directly, words get a space. */
export const unitSuffix = (unit: string): string => (!unit ? '' : ['×', '%', '°'].includes(unit) ? unit : ` ${unit}`);

export type Confidence = 'name' | 'inferred' | 'measured';

export interface FieldInfo {
  label: string;
  unit: string;
  /** Multiplier from the stored unit to the shown one (mph to km/h). */
  scale: number;
  /** Names for each number of a pair or triple. */
  parts: readonly string[];
  /** [input, output] names for curves. */
  axes: readonly [string, string];
  axisScale: readonly [number, number];
  sure: Confidence;
  tip: string;
  /** Which way is an improvement, per part (the last entry covers any further parts). */
  better: readonly Better[];
}

export function fieldInfo(labels: Labels, cfg: string, field: string): FieldInfo {
  const l = labels.fields[labelKey(cfg, field)];
  return {
    label: l?.label ?? human(field),
    unit: l?.unit ?? '',
    scale: l?.scale ?? 1,
    parts: l?.parts ?? [],
    axes: l?.axes ?? ['In', 'Out'],
    axisScale: l?.axisScale ?? [1, 1],
    sure: l?.sure ?? 'name',
    tip: l?.tip ?? '',
    better: typeof l?.better === 'string' ? [l.better] : (l?.better ?? ['higher']),
  };
}

/** Heading and description for a config struct's group in "What changes". */
export function groupInfo(labels: Labels, cfg: string): { heading: string; desc: string } {
  const key = cfg.replace(/^(Car|Bike|Skimmer|Plane)(?=[A-Z])/, '');
  const g = labels.groups[key];
  return g ? { heading: g[0], desc: g[1] } : { heading: human(key.replace(/^Vehicle/, '').replace(/Config$/, '')), desc: '' };
}

export type Direction = 'up' | 'down' | 'same';
export type Better = 'higher' | 'lower';
/** Whether a change is an improvement, which is what the readout colours. */
export type Tone = 'good' | 'bad' | 'same';

const toneOf = (d: Direction, better: Better): Tone => (d === 'same' ? 'same' : (d === 'up') === (better === 'higher') ? 'good' : 'bad');

/** One cell, formatted. */
export type FormattedValue =
  /** A yes/no setting. */
  | { kind: 'toggle'; base: string; value: string }
  /** Base value unknown (a code default): only the change, e.g. "20% more than default". */
  | { kind: 'change'; text: string; direction: Direction; tone: Tone }
  /** Base → value, with the % change from the unconverted numbers. */
  | { kind: 'number'; base: string; value: string; percent: string | null; direction: Direction; tone: Tone };

export function formatValue(base: number | boolean | undefined, value: CellValue, unit: string, scale = 1, better: Better = 'higher'): FormattedValue {
  const u = unitSuffix(unit);
  if (typeof value === 'boolean') return { kind: 'toggle', base: base === undefined ? 'default' : String(base), value: value ? 'yes' : 'no' };
  if (isModifier(value)) {
    const add = scale === 1 ? value.add : round1(value.add * scale);
    const parts: string[] = [];
    if (add) parts.push(`${add > 0 ? '+' : '−'}${fmt(Math.abs(add))}${u}`);
    if (value.mult) parts.push(`${fmt(Math.abs(value.mult * 100))}% ${value.mult > 0 ? 'more' : 'less'} than default`);
    if (value.mul !== 1) parts.push(`×${fmt(value.mul)}`);
    const direction: Direction = (add || value.mult) > 0 || value.mul > 1 ? 'up' : 'down';
    return { kind: 'change', text: parts.join(', ') || 'no change', direction, tone: toneOf(direction, better) };
  }
  const b = Number(base);
  const d = value - b;
  const shown = (n: number): string => fmt(scale === 1 ? n : round1(n * scale)) + u;
  const direction: Direction = d > 0 ? 'up' : d < 0 ? 'down' : 'same';
  return {
    kind: 'number',
    base: shown(b),
    value: shown(value),
    percent: b ? `${d > 0 ? '+' : ''}${fmt((100 * d) / Math.abs(b))}%` : null,
    direction,
    tone: toneOf(direction, better),
  };
}

export interface CurvePoint {
  /** Component name for vector curves; empty for float curves. */
  component: string;
  base: readonly [string, string];
  value: readonly [string, string];
  changed: readonly [boolean, boolean];
}

/** A curve as numbers in display units, before and with the build, for drawing. */
export interface CurveChart {
  base: readonly (readonly [number, number])[];
  value: readonly (readonly [number, number])[];
}

/** How a changed field is shown. */
export type RowDisplay =
  | { kind: 'single'; value: FormattedValue }
  | { kind: 'parts'; items: { name: string; value: FormattedValue }[] }
  | {
      kind: 'curve';
      changedPoints: number;
      axes: readonly [string, string];
      points: CurvePoint[];
      chart: CurveChart;
      /** What changed, one plain sentence per changed point. */
      changes: string[];
      /** What the curve means, shown with it. */
      explain: string;
    }
  /** e.g. a curve kept in a separate curve asset: the change applies, but there's no base to show it against. */
  | { kind: 'no-base' };

export interface RowView {
  label: string;
  /** Tooltip lines. */
  tip: string[];
  display: RowDisplay;
  sources: Row['sources'];
}

/** "Speed (km/h)" -> ["Speed", "km/h"]; "Grip blend" -> ["Grip blend", ""]. */
function axisParts(axis: string): [string, string] {
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(axis);
  return m ? [m[1] ?? axis, m[2] ?? ''] : [axis, ''];
}

export function describeRow(labels: Labels, r: Row): RowView {
  const info = fieldInfo(labels, r.cfg, r.field);
  const partName = (i: string): string => info.parts[Number(i)] ?? 'XYZ'[Number(i)] ?? i;
  const betterAt = (i: string): Better => info.better[Math.min(Number(i) || 0, info.better.length - 1)] ?? 'higher';
  // the tooltip explains what the value is; where its meaning came from stays in labels.json ("sure")
  const tip = info.tip ? [info.tip] : [];
  const base = { label: info.label, tip, sources: r.sources };
  const curveCells = r.cells.filter((c) => /k\d+\./.test(c.cell));
  if (!r.cells.length) return { ...base, display: { kind: 'no-base' } };

  if (!curveCells.length) {
    const only = r.cells[0];
    if (r.cells.length === 1 && only?.cell === '') return { ...base, display: { kind: 'single', value: formatValue(only.base, only.value, info.unit, info.scale, betterAt('')) } };
    const moved = r.cells.filter((c) => typeof c.value !== 'number' || c.value !== c.base);
    return {
      ...base,
      display: { kind: 'parts', items: (moved.length ? moved : r.cells).map((c) => ({ name: partName(c.cell), value: formatValue(c.base, c.value, info.unit, info.scale, betterAt(c.cell)) })) },
    };
  }

  // A float curve: show every point, marking the changed ones. (Vector curves aren't decoded; see ops.ts.)
  const keys = isFloatCurve(r.base) ? r.base.curve : [];
  const [sx, sy] = info.axisScale;
  const conv = (x: number, f: number): number => (f === 1 ? x : round1(x * f));
  const base2: [number, number][] = [];
  const value2: [number, number][] = [];
  const points: CurvePoint[] = keys.map((k, ki) => {
    const t = r.cells.find((c) => c.cell === `k${ki}.t`);
    const v = r.cells.find((c) => c.cell === `k${ki}.v`);
    const nt = t && typeof t.value === 'number' ? t.value : k[0];
    const nv = v && typeof v.value === 'number' ? v.value : k[1];
    base2.push([conv(k[0], sx), conv(k[1], sy)]);
    value2.push([conv(nt, sx), conv(nv, sy)]);
    return {
      component: '',
      base: [fmt(conv(k[0], sx)), fmt(conv(k[1], sy))],
      value: [fmt(conv(nt, sx)), fmt(conv(nv, sy))],
      changed: [t !== undefined, v !== undefined],
    };
  });
  const changedPoints = new Set(curveCells.map((c) => c.cell.replace(/\.[tv]$/, ''))).size;
  const [, xUnit] = axisParts(info.axes[0]);
  const [yName, yUnit] = axisParts(info.axes[1]);
  const at = (x: string): string => (xUnit ? `${x} ${xUnit}` : x);
  const of = (y: string): string => (yUnit ? `${y} ${yUnit}` : y);
  const changes = points.flatMap((p) => {
    const [bx, by] = p.base;
    const [nx, ny] = p.value;
    if (bx === nx && by === ny) return [];
    if (by === ny) return [`${yName} reaches ${of(by)} at ${at(nx)} (was ${at(bx)})`];
    if (bx === nx) return [`At ${at(bx)}: ${yName.toLowerCase()} ${by} → ${of(ny)}`];
    return [`${yName} ${of(by)} at ${at(bx)} → ${of(ny)} at ${at(nx)}`];
  });
  return {
    ...base,
    display: { kind: 'curve', changedPoints, axes: info.axes, points, chart: { base: base2, value: value2 }, changes, explain: info.tip },
  };
}

// The game's names for conditions and Ramjet states, as players see them in game text.
const CONDITION_NAMES: Record<string, string> = { Malfunction: 'System Malfunction', Overclocked: 'Overcharged' };
const RAMJET_STATES: Record<string, string> = { Ready: 'Ramjet ready', Active: 'Ramjet active', CriticalWarning: 'Redlining', Overheated: 'Overheated' };

const lastPart = (v: unknown): string => (typeof v === 'string' ? (v.split('.').pop() ?? v) : '');
const condition = (v: unknown): string => CONDITION_NAMES[lastPart(v)] ?? lastPart(v);
const ramjet = (v: unknown): string => (Array.isArray(v) ? v.map((x) => RAMJET_STATES[String(x)] ?? '').filter(Boolean).join(' or ') : '');
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/** One requirement in plain words, or '' when it adds nothing a player would recognise. */
function requirementText(r: Requirement, c: Conditional): string {
  const p = r.props;
  switch (r.type) {
    case 'TrackedVehicleCondition': return condition(p.Condition);
    case 'VehicleCondition':
      return p.ConditionStarted ? `${condition(p.ConditionStarted)} starts` : p.ConditionEnded ? `${condition(p.ConditionEnded)} ends` : condition(p.Condition);
    case 'TrackedRamjetState': return ramjet(p.ActiveRamjetStates);
    case 'RamjetState': return p.NewRamjetStates ? `${ramjet(p.NewRamjetStates)} starts` : p.PreviousRamjetStates ? `after ${ramjet(p.PreviousRamjetStates)}` : '';
    case 'TimeSpendPerformingNested': return c.perSecond ? `each second ${c.perSecond}` : '';
    case 'TrackedVehicleAirborne': return 'Airborne';
    case 'TrackedVehicleDrafting': return num(p.MinTimeDrafting) ? `Slipstreaming ${String(p.MinTimeDrafting)}s` : 'Slipstreaming';
    case 'VehicleLanding': return 'Landing';
    case 'VehiclePerfectStart': return 'Perfect start';
    case 'Takedown': return num(p.NumberOfTakedownsNeeded) ? `${String(p.NumberOfTakedownsNeeded)} Takedowns` : 'Takedown';
    case 'Overtake': return num(p.NumberOfOvertakesNeeded) ? `${String(p.NumberOfOvertakesNeeded)} overtakes` : 'Overtake';
    case 'Crashed': return 'Crash';
    case 'Contact': return 'Collision';
    case 'Timer': return num(p.TimerThreshold) ? `after ${String(p.TimerThreshold)}s` : '';
    case 'ActivateAbility': return 'Ability used';
    case 'TrackedEnergyLevel': return num(p.EnergyLevelRequired) ? `${String(p.EnergyLevelRequired)}+ Energy` : '';
    case 'VehicleSpeed': return num(p.VehicleSpeedThreshold) ? `speed ${String(p.VehicleSpeedThreshold)}+` : '';
    default: return '';
  }
}

/**
 * When a situational effect applies, in a player's words: "Burning + Ramjet ready", "While the ability is active".
 * Requirements a player wouldn't recognise are left out rather than shown by their internal names.
 */
export function conditionText(c: Conditional): string {
  if (c.kind === 'active') return 'While the ability is active';
  if (c.kind === 'victims') return 'Each opponent the blast hits';
  if (c.kind === 'ability') return 'Each time it triggers';
  const parts = (c.requires ?? []).map((r) => requirementText(r, c)).filter(Boolean);
  return [...new Set(parts)].join(' + ');
}

/** Splits text into plain and highlighted runs for the game's keyword phrases (whole words, longest first). */
export function highlight(text: string, keywords: readonly string[]): { text: string; keyword: boolean }[] {
  if (!keywords.length) return [{ text, keyword: false }];
  const escaped = [...keywords].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const rx = new RegExp(`\\b(${escaped.join('|')})\\b`, 'g');
  const out: { text: string; keyword: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(rx)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), keyword: false });
    out.push({ text: m[0], keyword: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), keyword: false });
  return out;
}
