// Schema for the datamine's export (ADR 0002, 0007). Strict objects throughout: a field the datamine adds,
// renames or drops fails validation, so the data contract can't drift silently.
import { z } from 'zod';

// ---- ids ---------------------------------------------------------------------------------------
// Branded, so a part id can't be passed where an ability id is expected.
export const VehicleId = z.string().min(1).brand<'VehicleId'>();
export const SlotId = z.string().min(1).brand<'SlotId'>();
export const StyleId = z.string().min(1).brand<'StyleId'>();
export const TraitId = z.string().min(1).brand<'TraitId'>();
export const AbilityId = z.string().min(1).brand<'AbilityId'>();
export const PartId = z.string().min(1).brand<'PartId'>();
export const FavourId = z.string().min(1).brand<'FavourId'>();
export const TunesetId = z.string().min(1).brand<'TunesetId'>();
export const IconName = z.string().min(1).brand<'IconName'>();
export const ArcadeEventId = z.string().min(1).brand<'ArcadeEventId'>();

/**
 * A reference that may be missing. The datamine writes "" for "none"; the import normalizes that to null and
 * commits the normalized form, so both are accepted here and the output is always `T | null`.
 */
const maybe = <T extends z.ZodType>(ref: T) => z.union([ref, z.null(), z.literal('').transform(() => null)]);

export const GameMode = z.enum(['mp', 'campaign']);
export const PartRarity = z.enum(['Common', 'Rare', 'Epic', 'Legendary', 'Faulty']);
export const OfferRarity = z.enum(['Common', 'Rare', 'Epic', 'Legendary']);
export const AbilityLevel = z.enum(['Level1', 'Level2', 'Level3']);

// ---- config values -----------------------------------------------------------------------------
const CurveKey = z.tuple([z.number(), z.number()]);
/** A float curve as [time, value] keys. */
export const FloatCurve = z.strictObject({ curve: z.array(CurveKey) });
/** A curve kept in a separate curve asset that the export doesn't resolve. */
export const ExternalCurve = z.strictObject({ ExternalCurve: z.string() });
const RichCurveKey = z.strictObject({
  InterpMode: z.string(),
  TangentMode: z.string(),
  TangentWeightMode: z.string(),
  Time: z.number(),
  Value: z.number(),
  ArriveTangent: z.number().optional(),
  ArriveTangentWeight: z.number().optional(),
  LeaveTangent: z.number().optional(),
  LeaveTangentWeight: z.number().optional(),
});
/** A vector curve in the game's raw form: one rich curve per component (`VectorCurves`, `VectorCurves[1]`, ...). */
export const RawVectorCurve = z.record(z.string().regex(/^VectorCurves(\[\d\])?$/), z.strictObject({ Keys: z.array(RichCurveKey) }));

export const ConfigValue = z.union([
  z.number(),
  z.boolean(),
  z.string(),
  z.array(z.number()),
  FloatCurve,
  ExternalCurve,
  RawVectorCurve,
]);
/** Config struct name -> field -> value, e.g. `VehicleThrustConfig.HighSpeedStep`. */
export const Configs = z.record(z.string(), z.record(z.string(), ConfigValue));

// ---- tunesets ----------------------------------------------------------------------------------
export const TuneOp = z.strictObject({
  op: z.string().min(1),
  cfg: z.string().min(1),
  field: z.string().min(1),
  f: z.number(),
  i: z.int(),
  v2: z.tuple([z.number(), z.number()]),
  v3: z.tuple([z.number(), z.number(), z.number()]),
  pri: z.int(),
});

export const Tuneset = z.discriminatedUnion('stacking', [
  /** Applied once per owner. */
  z.strictObject({ stacking: z.literal(false), ops: z.array(TuneOp) }),
  /** Applied once per step (upgrade levels, power); Podracer (`plane`) has its own ops. */
  z.strictObject({ stacking: z.literal(true), steps: z.int().positive(), core: z.array(TuneOp), plane: z.array(TuneOp) }),
]);

// ---- passive rules -----------------------------------------------------------------------------
/** Free-form game properties of a requirement or effect, as exported. */
const Props = z.record(z.string(), z.unknown());

export const Requirement = z.strictObject({ type: z.string().min(1), props: Props });
export const Effect = z.strictObject({ type: z.string().min(1), props: Props, tracked: z.boolean(), tunesets: z.array(TunesetId) });
export const Rule = z.strictObject({
  once: z.boolean(),
  requires: z.array(Requirement),
  effects: z.array(Effect),
  tunesets: z.array(TunesetId),
  /** Fires again on every occurrence of its event, so it stacks per trigger (ADR 0009). */
  repeat: z.literal(true).optional(),
  /** Set when the rule comes from a sub-passive granted by another rule. */
  via: z.string().optional(),
});

// ---- entities ----------------------------------------------------------------------------------
export const Vehicle = z.strictObject({
  id: VehicleId,
  name: z.string(),
  desc: z.string(),
  traits: z.array(z.strictObject({ name: z.string(), desc: z.string() })),
  icon: IconName,
  /** The Podracer has no top-down art. */
  art: maybe(IconName),
  configs: Configs,
});

export const Slot = z.strictObject({
  id: SlotId,
  name: z.string(),
  part: z.string(),
  icon: IconName,
  levels: z.array(
    z.strictObject({
      level: z.int().nonnegative(),
      part: z.string(),
      stat: z.int().nonnegative(),
      power: z.int().nonnegative(),
      /** Level 0 changes nothing, so it has no tuneset. */
      tuneset: maybe(TunesetId),
      stacking: z.boolean(),
    }),
  ),
});

export const Style = z.strictObject({
  id: StyleId,
  mode: GameMode,
  group: z.string(),
  /** Campaign styles come in ranks; Multiplayer styles have none. */
  rank: z.int().positive().nullable(),
  name: z.string(),
  desc: z.string(),
  icon: IconName,
  abilities: z.array(AbilityId),
  traits: z.array(TraitId),
  /** Upgrade priority per slot, from the game's AI build hints. */
  priority: z.record(z.string(), z.number()),
});

export const Trait = z.strictObject({ id: TraitId, name: z.string(), desc: z.string(), rules: z.array(Rule), icon: maybe(IconName) });

export const Ability = z.strictObject({
  id: AbilityId,
  name: z.string(),
  desc: z.string(),
  level: AbilityLevel,
  tag: z.string(),
  upgradesTo: z.array(AbilityId),
  mp: z.string(),
  campaign: z.string(),
  config: z.record(z.string(), z.unknown()),
  tunesets: z.array(TunesetId),
  /** Applied to your own vehicle while the ability is active (e.g. Surging Autopilot II's +6 Power). */
  activation: TunesetId.nullable(),
  icon: IconName,
});

export const Part = z.strictObject({
  id: PartId,
  name: z.string(),
  desc: z.string(),
  /** Phrases the game sets in its keyword style (`<H1>` tags). */
  hl: z.array(z.string()),
  rarity: PartRarity,
  /** Parts sharing a family are one effect at different rarities; null for one-offs. */
  family: z.int().nonnegative().nullable(),
  tier: z.int().positive().nullable(),
  mp: z.array(z.string()),
  campaign: z.array(z.string()),
  rules: z.array(Rule),
  icon: IconName,
  art: IconName,
});

export const Favour = z.strictObject({
  id: FavourId,
  group: z.string(),
  rank: z.int().positive(),
  name: z.string(),
  desc: z.string(),
  unlock: z.string(),
  negative: z.boolean(),
  icon: IconName,
  rules: z.array(Rule),
});

// ---- tour --------------------------------------------------------------------------------------
const Weighted = <T extends z.ZodType>(group: T) => z.strictObject({ group, weight: z.number().nonnegative() });
const PartPool = z.strictObject({
  parts: z.array(z.strictObject({ group: z.string(), weight: z.number().nonnegative(), faulty: z.number().nonnegative() })),
  abilities: z.array(Weighted(AbilityLevel)),
});

export const Tour = z.strictObject({
  planets: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      reward: PartPool,
      shop: PartPool,
      baseCredits: z.number(),
      placeCredits: z.array(z.number()),
      eventReward: z.array(z.strictObject({ type: z.string(), weight: z.number().nonnegative() })),
      underdogCredits: z.number(),
    }),
  ),
  risk: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      minFinish: z.int().positive(),
      minRarity: OfferRarity,
      extraOptions: z.int().nonnegative(),
      skipCredits: z.number(),
    }),
  ),
  raceReward: z.strictObject({ type: z.string(), upgradeLevel: z.int() }),
  partGroups: z.record(z.string(), z.array(PartId)),
  abilityGroups: z.record(AbilityLevel, z.array(AbilityId)),
  prices: z.strictObject({
    part: z.record(OfferRarity, z.number()),
    ability: z.record(AbilityLevel, z.number()),
    upgrade: z.array(z.number()),
    partPack: z.number(),
    partPackIncrease: z.number(),
    abilityPack: z.number(),
    abilityPackIncrease: z.number(),
    reroll: z.number(),
    rerollIncrease: z.number(),
    startingCredits: z.number(),
  }),
  shop: z.strictObject({ parts: z.int().positive(), upgrades: z.int().nonnegative() }),
  /** Percent chance an offered part comes from a family you already own. */
  familyChance: z.number().min(0).max(100),
  backers: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      icon: IconName,
      contracts: z.array(
        z.strictObject({ id: z.string(), name: z.string(), units: z.string(), target: z.number().nullable(), perUnit: z.number() }),
      ),
    }),
  ),
  form: z.strictObject({
    positionScore: z.array(z.int()),
    betScore: z.record(z.string(), z.int()),
    underdogs: z.int().nonnegative(),
    includeAi: z.boolean(),
    reward: z.strictObject({ type: z.string(), skippable: z.boolean() }),
  }),
});

// ---- Arcade events: the game's pre-made vehicles ------------------------------------------------
export const ArcadeEventType = z.enum(['TimeTrial', 'Precision', 'TeamRace']);
export const ArcadeEvent = z.strictObject({
  id: ArcadeEventId,
  name: z.string().min(1),
  desc: z.string(),
  /** The Arcade tab it sits under (EArcadeEventCategories). */
  category: z.string().min(1),
  type: ArcadeEventType,
  vehicle: VehicleId,
  planet: z.string().min(1),
  track: z.string().min(1),
  laps: z.int().positive().nullable(),
  /** The card's background colour, RRGGBB. */
  colour: z.string().regex(/^[0-9A-F]{6}$/i),
  /** What unlocks it, as the game says it; null when it starts unlocked. */
  lock: z.string().min(1).nullable(),
  /** The event whose medal unlocks this one, when that's another Arcade event. */
  lockedBy: ArcadeEventId.nullable(),
  /** Gold, silver and bronze times in seconds, fastest first. */
  medals: z.array(z.number().positive()).length(3),
  levels: z.record(SlotId, z.int().min(0).max(10)),
  parts: z.array(PartId),
  abilities: z.array(AbilityId),
  /** False when the vehicle races without a Ramjet. */
  ramjet: z.boolean(),
  /** True when the event sets the vehicle's stats itself, so levels and parts don't tell the whole story. */
  authoredStats: z.boolean(),
});

// ---- the whole export --------------------------------------------------------------------------
export const PlannerData = z.strictObject({
  meta: z.strictObject({
    game: z.string(),
    build: z.string(),
    mode: z.string(),
    abilitySlots: z.int().positive(),
    partSlots: z.strictObject({ start: z.int().nonnegative(), max: z.int().positive() }),
    modes: z.record(GameMode, z.strictObject({ name: z.string(), vehicles: z.array(VehicleId) })),
  }),
  vehicles: z.array(Vehicle),
  /** Game-wide config values that aren't per vehicle. */
  globals: Configs,
  slots: z.array(Slot),
  /** The stacking tuneset that turns Power into top speed. */
  powerTuneset: TunesetId,
  styles: z.array(Style),
  traits: z.record(TraitId, Trait),
  abilities: z.array(Ability),
  affixes: z.array(Part),
  favours: z.array(Favour),
  tunesets: z.record(TunesetId, Tuneset),
  tour: Tour,
  /** Arcade events in the game's order. */
  arcade: z.array(ArcadeEvent),
});

// ---- files that ship alongside the data --------------------------------------------------------
/** Exported icon index: pixel size, and whether it's a white glyph the UI tints. */
export const IconIndex = z.record(
  IconName,
  z.strictObject({ w: z.int().positive(), h: z.int().positive(), glyph: z.boolean(), kb: z.number().nonnegative() }),
);

/** Hand-written field labels (owned by this repo, not the datamine). */
export const Labels = z.strictObject({
  _about: z.string(),
  /** Config struct -> [heading, description]. */
  groups: z.record(z.string(), z.tuple([z.string(), z.string()])),
  /** `Config.Field` with the Car/Bike/Skimmer/Plane prefix dropped. */
  fields: z.record(
    z.string(),
    z.strictObject({
      label: z.string().min(1),
      unit: z.string(),
      sure: z.enum(['name', 'inferred', 'measured']),
      tip: z.string(),
      scale: z.number().optional(),
      parts: z.array(z.string()).optional(),
      axes: z.tuple([z.string(), z.string()]).optional(),
      axisScale: z.tuple([z.number(), z.number()]).optional(),
      /** Which way is an improvement, when it's lower; one entry per part when the parts differ. */
      better: z.union([z.literal('lower'), z.array(z.enum(['higher', 'lower']))]).optional(),
    }),
  ),
});

/** Where the committed data came from. */
export const Manifest = z.strictObject({
  game: z.string(),
  gameBuild: z.string(),
  usmap: z.string().nullable(),
  plannerSha256: z.string().regex(/^[0-9a-f]{64}$/),
  icons: z.int().nonnegative(),
  importedAt: z.iso.datetime(),
});
