// A build: everything the player chooses, plus which situational effects are counted.
import { planner } from '../data/index.ts';
import type { Ability, AbilityId, FavourId, GameMode, Part, PartId, PlannerData, SlotId, StyleId, VehicleId } from '../data/types.ts';

/** A situational effect counted once (`true`) or a number of times (stacking effects). */
export type ActiveCount = true | number;

export interface Build {
  mode: GameMode;
  vehicle: VehicleId;
  style: StyleId;
  /** Upgrade level per slot, 0-10. Missing slots are level 0. */
  levels: Partial<Record<SlotId, number>>;
  parts: PartId[];
  abilities: AbilityId[];
  /** Campaign only. */
  favours: FavourId[];
  /** Situational effects to count, keyed by `Conditional.key`. */
  active: Record<string, ActiveCount>;
}

export const MAX_LEVEL = 10;

/** True when a list's value means the item is available in that mode (a non-empty list or string). */
const has = (v: string | readonly string[]): boolean => v.length > 0;

/** Faulty parts sit in the Multiplayer part groups, but every Multiplayer reward and shop pool rolls them at 0%. */
export const partAllowed = (p: Part, mode: GameMode): boolean => has(p[mode]) && !(mode === 'mp' && p.rarity === 'Faulty');

export const abilityAllowed = (a: Ability, mode: GameMode): boolean => has(a[mode]);

export const stylesFor = (mode: GameMode, data: PlannerData = planner) => data.styles.filter((s) => s.mode === mode);

/** A new build for a mode: the first style, its starting abilities, every slot at 0. */
export function freshBuild(mode: GameMode = 'mp', data: PlannerData = planner): Build {
  const style = stylesFor(mode, data)[0];
  if (!style) throw new Error(`no racer styles for mode ${mode}`);
  return {
    mode,
    vehicle: 'Car' as VehicleId,
    style: style.id,
    levels: Object.fromEntries(data.slots.map((s) => [s.id, 0])),
    parts: [],
    abilities: [...style.abilities],
    favours: [],
    active: {},
  };
}
