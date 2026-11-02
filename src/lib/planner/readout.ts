// What the readout column shows, derived from an evaluation (ported from the legacy planner).
import { labelKey } from '../data/references.ts';
import type { Labels, PlannerData, Slot, VehicleId } from '../data/types.ts';
import type { AbilityId } from '../data/types.ts';
import type { Evaluation, Row } from '../engine/evaluate.ts';
import { isModifier } from '../engine/ops.ts';
import { conditionText, describeRow, fieldInfo, fmt, groupInfo, type RowView } from '../format/format.ts';

/** Key stats always listed in "What changes", at their base value when the build doesn't touch them. */
export const PINNED: readonly (readonly [cfg: string, field: string])[] = [
  ['VehicleAfterburnerConfig', 'TopSpeedIncreaseMph'],
  ['VehicleRamjetConfig', 'TopSpeedIncreaseMph'],
];

export interface ChangeView {
  key: string;
  view: RowView;
  /** Set for a pinned stat the build doesn't change. */
  pinned: boolean;
}

export interface ChangeGroup {
  heading: string;
  desc: string;
  rows: ChangeView[];
}

/** "What changes": changed fields plus the pinned key stats, grouped by game system and sorted by heading. */
export function changeGroups(data: PlannerData, labels: Labels, vehicle: VehicleId, result: Evaluation): ChangeGroup[] {
  const veh = data.vehicles.find((v) => v.id === vehicle);
  const rows: { row: Row; pinned: boolean }[] = result.rows.map((row) => ({ row, pinned: false }));
  for (const [cfg, field] of PINNED) {
    if (result.rows.some((r) => r.cfg === cfg && r.field === field)) continue;
    const base = veh?.configs[cfg]?.[field] ?? data.globals[cfg]?.[field];
    if (typeof base === 'number') rows.push({ row: { cfg, field, base, cells: [{ cell: '', base, value: base }], known: true, sources: [] }, pinned: true });
  }
  const groups = new Map<string, ChangeGroup>();
  for (const { row, pinned } of rows) {
    const { heading, desc } = groupInfo(labels, row.cfg);
    let g = groups.get(heading);
    if (!g) {
      g = { heading, desc, rows: [] };
      groups.set(heading, g);
    }
    g.rows.push({ key: `${row.cfg}.${row.field}`, view: describeRow(labels, row), pinned });
  }
  return [...groups.values()].sort((a, b) => a.heading.localeCompare(b.heading));
}

/** The labels of what an upgrade slot improves on this vehicle, for its tooltip. */
export function slotImproves(data: PlannerData, labels: Labels, slot: Slot, vehicle: VehicleId): string[] {
  const name = slot.levels[1]?.tuneset;
  const ts = name ? data.tunesets[name] : undefined;
  if (!ts) return [];
  const ops = ts.stacking ? (vehicle === 'Plane' ? ts.plane : ts.core) : ts.ops;
  const mine = ops.filter((o) => {
    const c = /^(Car|Bike|Skimmer|Plane)(?=[A-Z])/.exec(o.cfg);
    return !c || c[1] === vehicle;
  });
  return [...new Set(mine.map((o) => (labels.fields[labelKey(o.cfg, o.field)] ? fieldInfo(labels, o.cfg, o.field).label : o.field)))];
}

/**
 * The short "when" line for situational effects that need one, by key: an ability's while-active effect, effects
 * without a description, and effects that share an owner (one trait, several rules), which would otherwise look the
 * same. Everything else is explained by its own description; the numbers are in "What changes".
 */
export function situationalWhen(result: Evaluation): Map<string, string> {
  const owners = result.conditionals.map((c) => c.owner);
  const shared = new Set(owners.filter((o, i) => owners.indexOf(o) !== i));
  const out = new Map<string, string>();
  for (const c of result.conditionals) {
    const when = c.kind === 'active' || !c.desc || shared.has(c.owner) ? conditionText(c) : '';
    if (when) out.set(c.key, when);
  }
  return out;
}

/** One installed ability's reload time: the game's own, and with every reload change in this build applied. */
export interface Cooldown {
  /** Seconds between uses as the game sets it; 0 for crash abilities, which go off when you crash. */
  base: number;
  /** Seconds with this build, counted situational effects included. */
  seconds: number;
}

/**
 * Reload times for the installed abilities. Every reload change in the game ("Abilities reload 50% faster") scales
 * one global multiplier, AbilityTuneConfig.GlobalCooldownScale, whose base is a code default of 1.
 */
export function abilityCooldowns(data: PlannerData, abilities: readonly AbilityId[], result: Evaluation): Map<AbilityId, Cooldown> {
  const cell = result.rows.find((r) => r.cfg === 'AbilityTuneConfig' && r.field === 'GlobalCooldownScale')?.cells[0]?.value;
  const scale = cell === undefined ? 1 : isModifier(cell) ? (1 + cell.add + cell.mult) * cell.mul : typeof cell === 'number' ? cell : 1;
  const out = new Map<AbilityId, Cooldown>();
  for (const id of abilities) {
    const warmUp = data.abilities.find((a) => a.id === id)?.config.WarmUpTime;
    const base = typeof warmUp === 'number' ? warmUp : 0;
    out.set(id, { base, seconds: base * Math.max(0, scale) });
  }
  return out;
}

/** "Reload 7.5 s (was 15 s)", "Reload 15 s", or "Goes off when you crash". */
export function cooldownText(c: Cooldown): string {
  if (c.base === 0) return 'Goes off when you crash';
  const now = fmt(Math.round(c.seconds * 10) / 10);
  return now === fmt(c.base) ? `Reload ${now} s` : `Reload ${now} s (was ${fmt(c.base)} s)`;
}
