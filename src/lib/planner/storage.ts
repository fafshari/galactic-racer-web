// The last build, kept in the browser between visits under the legacy planner's key, so returning users keep theirs.
// Saved data is untrusted (older versions, other tabs, hand edits), so it's validated and cleaned before use.
import { z } from 'zod';
import type { AbilityId, FavourId, PartId, PlannerData, SlotId } from '../data/types.ts';
import { freshBuild, MAX_LEVEL, type Build } from '../engine/build.ts';

export const STORAGE_KEY = 'swgr-build';

const Saved = z.object({
  mode: z.enum(['mp', 'campaign']).optional(),
  vehicle: z.string(),
  style: z.string(),
  levels: z.record(z.string(), z.number()).optional(),
  parts: z.array(z.string()).optional(),
  abilities: z.array(z.string()).optional(),
  favours: z.array(z.string()).optional(),
  active: z.record(z.string(), z.union([z.literal(true), z.number()])).optional(),
});

/** Restores a saved build, dropping anything the current data no longer has. Null when there's nothing usable. */
export function restoreBuild(data: PlannerData, raw: unknown): Build | null {
  const r = Saved.safeParse(raw);
  if (!r.success) return null;
  const s = r.data;
  const style = data.styles.find((x) => x.id === s.style);
  const vehicle = data.vehicles.find((x) => x.id === s.vehicle);
  if (!style || !vehicle) return null;
  const mode = s.mode ?? style.mode;
  const pick = <T extends string>(ids: readonly string[] | undefined, known: readonly { id: T }[]): T[] =>
    (ids ?? []).map((id) => known.find((k) => k.id === id)?.id).filter((id) => id !== undefined);
  const levels = Object.fromEntries(
    data.slots.map((slot) => [slot.id, Math.max(0, Math.min(MAX_LEVEL, Math.round(s.levels?.[slot.id] ?? 0)))]),
  ) as Partial<Record<SlotId, number>>;
  return {
    ...freshBuild(mode, data),
    vehicle: vehicle.id,
    style: style.id,
    levels,
    parts: pick<PartId>(s.parts, data.affixes).slice(0, data.meta.partSlots.max),
    abilities: pick<AbilityId>(s.abilities, data.abilities).slice(0, data.meta.abilitySlots),
    favours: mode === 'campaign' ? pick<FavourId>(s.favours, data.favours) : [],
    active: s.active ?? {},
  };
}
