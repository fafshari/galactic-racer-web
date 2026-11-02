// What the readout column shows, derived from an evaluation (ported from the legacy planner).
import { labelKey } from '../data/references.ts';
import type { Labels, PlannerData, Slot, VehicleId } from '../data/types.ts';
import type { Evaluation, Row } from '../engine/evaluate.ts';
import { describeRow, fieldInfo, groupInfo, type RowView } from '../format/format.ts';

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
