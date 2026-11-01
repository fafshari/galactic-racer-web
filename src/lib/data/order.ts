// Build codes store positions, not ids (ADR 0010). This order is the permanent position of every id ever exported:
// an id keeps its position forever, new ids go at the end, and ids the game removes stay as retired entries so the
// positions after them never shift. That keeps every shared build link loading the same build across game patches.
import { z } from 'zod';
import type { PlannerData } from './types.ts';

export const ORDER_KINDS = ['vehicles', 'slots', 'styles', 'parts', 'abilities', 'favours'] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];

/** Most positions each kind can address in a `gr2` build code. */
export const ORDER_CAPACITY: Readonly<Record<OrderKind, number>> = {
  vehicles: 10, // one decimal digit
  slots: 6, // the format has exactly six level digits
  styles: 36 * 36, // two base-36 digits
  parts: 36 * 36,
  abilities: 36 * 36,
  favours: 36 * 36,
};

export const BuildOrder = z.strictObject({
  version: z.literal(1),
  vehicles: z.array(z.string().min(1)),
  slots: z.array(z.string().min(1)),
  styles: z.array(z.string().min(1)),
  parts: z.array(z.string().min(1)),
  abilities: z.array(z.string().min(1)),
  favours: z.array(z.string().min(1)),
});
export type BuildOrder = z.output<typeof BuildOrder>;

/** Current ids per kind, in export order. */
export function idsOf(data: PlannerData): Record<OrderKind, readonly string[]> {
  return {
    vehicles: data.vehicles.map((v) => v.id),
    slots: data.slots.map((s) => s.id),
    styles: data.styles.map((s) => s.id),
    parts: data.affixes.map((p) => p.id),
    abilities: data.abilities.map((a) => a.id),
    favours: data.favours.map((f) => f.id),
  };
}

export interface OrderChange {
  kind: OrderKind;
  added: string[];
  /** In the order but no longer exported; kept so later positions don't move. */
  retired: string[];
}

export interface MergeResult {
  order: BuildOrder;
  changes: OrderChange[];
  /** Problems that would break build codes; the import must stop if any. */
  errors: string[];
}

/**
 * Merges freshly exported ids into the existing order. With no existing order, the export order becomes the order,
 * which matches the legacy site's build codes (they index straight into the export arrays).
 */
export function mergeOrder(existing: BuildOrder | null, data: PlannerData): MergeResult {
  const current = idsOf(data);
  const order: BuildOrder = { version: 1, vehicles: [], slots: [], styles: [], parts: [], abilities: [], favours: [] };
  const changes: OrderChange[] = [];
  const errors: string[] = [];

  for (const kind of ORDER_KINDS) {
    const before = existing?.[kind] ?? [];
    const known = new Set(before);
    const now = new Set(current[kind]);
    const added = current[kind].filter((id) => !known.has(id));
    const retired = before.filter((id) => !now.has(id));
    const merged = [...before, ...added];
    order[kind] = merged;
    if (added.length || retired.length) changes.push({ kind, added, retired });
    if (merged.length > ORDER_CAPACITY[kind]) {
      errors.push(`${kind}: ${merged.length} positions exceed the build-code capacity of ${ORDER_CAPACITY[kind]}`);
    }
    if (new Set(merged).size !== merged.length) errors.push(`${kind}: duplicate ids in the order`);
    // The six level digits are positional, so the slot list itself must never change.
    if (kind === 'slots' && existing && (added.length || retired.length)) {
      errors.push('slots changed: the gr2 build-code format assumes the same six upgrade slots');
    }
  }
  return { order, changes, errors };
}
