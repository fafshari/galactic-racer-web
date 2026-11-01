// Types for the game data, derived from the schema so the two can't disagree (ADR 0007).
// Everything is deeply readonly: game data is never mutated after import.
import type { z } from 'zod';
import type * as S from './schema.ts';

/**
 * Recursively readonly. Branded strings are left alone, so their brand survives, and the mapped type keeps tuples
 * as tuples (`[number, number]` stays a pair, not `number[]`).
 */
export type DeepReadonly<T> = unknown extends T
  ? T // free-form game properties stay `unknown`, to be narrowed where they're read
  : T extends string | number | boolean | null | undefined
    ? T
    : { readonly [K in keyof T]: DeepReadonly<T[K]> };

type Data<T extends z.ZodType> = DeepReadonly<z.output<T>>;

export type VehicleId = z.output<typeof S.VehicleId>;
export type SlotId = z.output<typeof S.SlotId>;
export type StyleId = z.output<typeof S.StyleId>;
export type TraitId = z.output<typeof S.TraitId>;
export type AbilityId = z.output<typeof S.AbilityId>;
export type PartId = z.output<typeof S.PartId>;
export type FavourId = z.output<typeof S.FavourId>;
export type TunesetId = z.output<typeof S.TunesetId>;
export type IconName = z.output<typeof S.IconName>;

export type GameMode = z.output<typeof S.GameMode>;
export type PartRarity = z.output<typeof S.PartRarity>;
export type OfferRarity = z.output<typeof S.OfferRarity>;
export type AbilityLevel = z.output<typeof S.AbilityLevel>;

export type ConfigValue = Data<typeof S.ConfigValue>;
export type FloatCurve = Data<typeof S.FloatCurve>;
export type Configs = Data<typeof S.Configs>;
export type TuneOp = Data<typeof S.TuneOp>;
export type Tuneset = Data<typeof S.Tuneset>;
export type Requirement = Data<typeof S.Requirement>;
export type Effect = Data<typeof S.Effect>;
export type Rule = Data<typeof S.Rule>;

export type Vehicle = Data<typeof S.Vehicle>;
export type Slot = Data<typeof S.Slot>;
export type Style = Data<typeof S.Style>;
export type Trait = Data<typeof S.Trait>;
export type Ability = Data<typeof S.Ability>;
export type Part = Data<typeof S.Part>;
export type Favour = Data<typeof S.Favour>;
export type Tour = Data<typeof S.Tour>;

export type PlannerData = Data<typeof S.PlannerData>;
export type IconIndex = Data<typeof S.IconIndex>;
export type Labels = Data<typeof S.Labels>;
export type Manifest = Data<typeof S.Manifest>;
