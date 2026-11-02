// Cross-reference checks the schema can't express: every id the data points at must exist.
import type { IconIndex, IconName, Labels, PlannerData, Rule, TuneOp } from './types.ts';

const VEHICLE_CLASS = /^(Car|Bike|Skimmer|Plane)(?=[A-Z])/;

/** Label key for a config field: the Car/Bike/Skimmer/Plane prefix is dropped so one label covers every class. */
export function labelKey(cfg: string, field: string): string {
  return `${cfg.replace(VEHICLE_CLASS, '')}.${field}`;
}

function allOps(data: PlannerData): TuneOp[] {
  return Object.values(data.tunesets).flatMap((ts) => (ts.stacking ? [...ts.core, ...ts.plane] : [...ts.ops]));
}

/** Returns one message per broken reference; empty when the data is consistent. */
export function checkReferences(data: PlannerData, icons: IconIndex): string[] {
  const problems: string[] = [];
  const has = <K extends string>(set: ReadonlySet<K>, id: K, where: string): void => {
    if (!set.has(id)) problems.push(`${where}: unknown id "${id}"`);
  };

  const vehicles = new Set(data.vehicles.map((v) => v.id));
  const abilities = new Set(data.abilities.map((a) => a.id));
  const parts = new Set(data.affixes.map((p) => p.id));
  const traits = new Set(Object.keys(data.traits) as (keyof PlannerData['traits'])[]);
  const tunesets = new Set(Object.keys(data.tunesets) as (keyof PlannerData['tunesets'])[]);
  const iconNames = new Set(Object.keys(icons) as IconName[]);
  const icon = (name: IconName | null, where: string): void => {
    if (name !== null) has(iconNames, name, `${where} icon`);
  };
  const rules = (list: readonly Rule[], where: string): void => {
    list.forEach((r, i) => {
      for (const t of r.tunesets) has(tunesets, t, `${where} rule ${i}`);
      for (const e of r.effects) for (const t of e.tunesets) has(tunesets, t, `${where} rule ${i} effect ${e.type}`);
    });
  };

  for (const [mode, m] of Object.entries(data.meta.modes)) for (const v of m.vehicles) has(vehicles, v, `meta.modes.${mode}`);
  has(tunesets, data.powerTuneset, 'powerTuneset');
  for (const v of data.vehicles) {
    icon(v.icon, `vehicle ${v.id}`);
    icon(v.art, `vehicle ${v.id} art`);
  }
  for (const s of data.slots) {
    icon(s.icon, `slot ${s.id}`);
    for (const l of s.levels) if (l.tuneset !== null) has(tunesets, l.tuneset, `slot ${s.id} level ${l.level}`);
  }
  for (const s of data.styles) {
    icon(s.icon, `style ${s.id}`);
    for (const a of s.abilities) has(abilities, a, `style ${s.id}`);
    for (const t of s.traits) has(traits, t, `style ${s.id}`);
  }
  for (const t of Object.values(data.traits)) {
    icon(t.icon, `trait ${t.id}`);
    rules(t.rules, `trait ${t.id}`);
  }
  for (const a of data.abilities) {
    icon(a.icon, `ability ${a.id}`);
    for (const u of a.upgradesTo) has(abilities, u, `ability ${a.id} upgradesTo`);
    for (const t of a.tunesets) has(tunesets, t, `ability ${a.id}`);
    if (a.activation !== null) has(tunesets, a.activation, `ability ${a.id} activation`);
  }
  for (const p of data.affixes) {
    icon(p.icon, `part ${p.id}`);
    icon(p.art, `part ${p.id} art`);
    rules(p.rules, `part ${p.id}`);
  }
  for (const f of data.favours) {
    icon(f.icon, `favour ${f.id}`);
    rules(f.rules, `favour ${f.id}`);
  }
  for (const [group, ids] of Object.entries(data.tour.partGroups)) for (const id of ids) has(parts, id, `tour.partGroups.${group}`);
  for (const [level, ids] of Object.entries(data.tour.abilityGroups)) for (const id of ids) has(abilities, id, `tour.abilityGroups.${level}`);
  for (const b of data.tour.backers) icon(b.icon, `backer ${b.id}`);
  return problems;
}

/** Every field a tuneset can change needs a human label, and every config group a heading (ADR 0013). */
export function checkLabels(data: PlannerData, labels: Labels): string[] {
  const problems = new Set<string>();
  for (const o of allOps(data)) {
    const key = labelKey(o.cfg, o.field);
    if (!(key in labels.fields)) problems.add(`no label for field ${key}`);
    const group = o.cfg.replace(VEHICLE_CLASS, '');
    if (!(group in labels.groups)) problems.add(`no heading for group ${group}`);
  }
  return [...problems];
}
