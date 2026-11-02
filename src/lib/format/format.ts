// Turns engine output into display-ready values (no HTML), so components stay thin and this stays testable.
// Ported from the legacy planner's readout helpers.
import { labelKey } from '../data/references.ts';
import type { Labels } from '../data/types.ts';
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
  };
}

/** Heading and description for a config struct's group in "What changes". */
export function groupInfo(labels: Labels, cfg: string): { heading: string; desc: string } {
  const key = cfg.replace(/^(Car|Bike|Skimmer|Plane)(?=[A-Z])/, '');
  const g = labels.groups[key];
  return g ? { heading: g[0], desc: g[1] } : { heading: human(key.replace(/^Vehicle/, '').replace(/Config$/, '')), desc: '' };
}

export type Direction = 'up' | 'down' | 'same';

/** One cell, formatted. */
export type FormattedValue =
  /** A yes/no setting. */
  | { kind: 'toggle'; base: string; value: string }
  /** Base value unknown (a code default): only the change, e.g. "+20% of default". */
  | { kind: 'change'; text: string; direction: Direction }
  /** Base → value, with the % change from the unconverted numbers. */
  | { kind: 'number'; base: string; value: string; percent: string | null; direction: Direction };

export function formatValue(base: number | boolean | undefined, value: CellValue, unit: string, scale = 1): FormattedValue {
  const u = unitSuffix(unit);
  if (typeof value === 'boolean') return { kind: 'toggle', base: base === undefined ? 'default' : String(base), value: value ? 'yes' : 'no' };
  if (isModifier(value)) {
    const add = scale === 1 ? value.add : round1(value.add * scale);
    const parts: string[] = [];
    if (add) parts.push(`${add > 0 ? '+' : '−'}${fmt(Math.abs(add))}${u}`);
    if (value.mult) parts.push(`${value.mult > 0 ? '+' : '−'}${fmt(Math.abs(value.mult * 100))}% of default`);
    if (value.mul !== 1) parts.push(`×${fmt(value.mul)}`);
    return { kind: 'change', text: parts.join(', ') || 'no change', direction: (add || value.mult) > 0 || value.mul > 1 ? 'up' : 'down' };
  }
  const b = Number(base);
  const d = value - b;
  const shown = (n: number): string => fmt(scale === 1 ? n : round1(n * scale)) + u;
  return {
    kind: 'number',
    base: shown(b),
    value: shown(value),
    percent: b ? `${d > 0 ? '+' : ''}${fmt((100 * d) / Math.abs(b))}%` : null,
    direction: d > 0 ? 'up' : d < 0 ? 'down' : 'same',
  };
}

export interface CurvePoint {
  /** Component name for vector curves; empty for float curves. */
  component: string;
  base: readonly [string, string];
  value: readonly [string, string];
  changed: readonly [boolean, boolean];
}

/** How a changed field is shown. */
export type RowDisplay =
  | { kind: 'single'; value: FormattedValue }
  | { kind: 'parts'; items: { name: string; value: FormattedValue }[] }
  | { kind: 'curve'; changedPoints: number; axes: readonly [string, string]; points: CurvePoint[] }
  /** e.g. a curve kept in a separate curve asset: the change applies, but there's no base to show it against. */
  | { kind: 'no-base' };

export interface RowView {
  label: string;
  /** Tooltip lines. */
  tip: string[];
  display: RowDisplay;
  sources: Row['sources'];
}

const CONFIDENCE_NOTE: Record<Confidence, string> = {
  name: "Meaning taken from the game's own field name.",
  inferred: 'Meaning worked out from how the values behave; not confirmed by game code.',
  measured: 'Value measured in game; it is not in the game data.',
};

export function describeRow(labels: Labels, r: Row): RowView {
  const info = fieldInfo(labels, r.cfg, r.field);
  const partName = (i: string): string => info.parts[Number(i)] ?? 'XYZ'[Number(i)] ?? i;
  const tip = [
    ...(info.tip ? [info.tip] : []),
    ...(r.known ? [] : ['Base value is a code default, so only the change is shown.']),
    CONFIDENCE_NOTE[info.sure],
    `Game name: ${r.cfg}.${r.field}`,
  ];
  const base = { label: info.label, tip, sources: r.sources };
  const curveCells = r.cells.filter((c) => /k\d+\./.test(c.cell));
  if (!r.cells.length) return { ...base, display: { kind: 'no-base' } };

  if (!curveCells.length) {
    const only = r.cells[0];
    if (r.cells.length === 1 && only?.cell === '') return { ...base, display: { kind: 'single', value: formatValue(only.base, only.value, info.unit, info.scale) } };
    const moved = r.cells.filter((c) => typeof c.value !== 'number' || c.value !== c.base);
    return {
      ...base,
      display: { kind: 'parts', items: (moved.length ? moved : r.cells).map((c) => ({ name: partName(c.cell), value: formatValue(c.base, c.value, info.unit, info.scale) })) },
    };
  }

  // A float curve: show every point, marking the changed ones. (Vector curves aren't decoded; see ops.ts.)
  const keys = isFloatCurve(r.base) ? r.base.curve : [];
  const [sx, sy] = info.axisScale;
  const conv = (x: number, f: number): number => (f === 1 ? x : round1(x * f));
  const points: CurvePoint[] = keys.map((k, ki) => {
    const t = r.cells.find((c) => c.cell === `k${ki}.t`);
    const v = r.cells.find((c) => c.cell === `k${ki}.v`);
    const nt = t && typeof t.value === 'number' ? t.value : k[0];
    const nv = v && typeof v.value === 'number' ? v.value : k[1];
    return {
      component: '',
      base: [fmt(conv(k[0], sx)), fmt(conv(k[1], sy))],
      value: [fmt(conv(nt, sx)), fmt(conv(nv, sy))],
      changed: [t !== undefined, v !== undefined],
    };
  });
  const changedPoints = new Set(curveCells.map((c) => c.cell.replace(/\.[tv]$/, ''))).size;
  return { ...base, display: { kind: 'curve', changedPoints, axes: info.axes, points } };
}

/** One line describing what sets off a situational effect. */
export function conditionLabel(c: Conditional): string {
  if (c.kind === 'ability') return 'Ability bonus (e.g. per overtake)';
  const req = (c.requires ?? []).map((r) => {
    if (r.type === 'TimeSpendPerformingNested' && c.perSecond) return `Each second ${c.perSecond}`;
    const v = Object.values(r.props).find((x): x is string => typeof x === 'string' && x.includes('.'));
    return human(r.type) + (v ? `: ${v.split('.').pop() ?? v}` : '');
  });
  const eff = c.effect ? `${c.effect.tracked ? 'Tracked' : 'Triggered'} effect: ${human(c.effect.type)}` : '';
  return [...req, eff].filter(Boolean).join(' · ');
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
