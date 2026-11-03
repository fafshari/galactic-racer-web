// The game's Arcade events: pre-made vehicles raced against medal times. Each one's vehicle opens in the planner as a
// build with no racer style (the game gives them none).
import type { ArcadeEvent, ArcadeEventType, GameMode, IconName, PartRarity, PlannerData, SlotId } from '../data/types.ts';
import { fitAbilities, freshBuild, MAX_LEVEL, type Build } from '../engine/build.ts';
import { encodeBuild } from '../engine/codes.ts';
import { evaluate } from '../engine/evaluate.ts';
import { speeds, toKmh } from '../engine/speeds.ts';

/** The Arcade tabs. The game's tab names aren't in the exported data, so these are ours. */
export const CATEGORY_NAMES: Readonly<Record<string, string>> = {
  FieldTest: 'Field Test',
  Plane: 'Podracing',
  Precision: 'Precision',
  Advanced: 'Advanced',
  FireIce: 'Fire and Ice',
  Quick: 'Quick',
  Acid: 'Acid',
  Deluxe: 'Deluxe',
};

export const TYPE_NAMES: Readonly<Record<ArcadeEventType, string>> = {
  TimeTrial: 'Time Trial',
  Precision: 'Precision',
  TeamRace: 'Team Race',
};

export const MEDALS = ['Gold', 'Silver', 'Bronze'] as const;
export type Medal = (typeof MEDALS)[number];

/** A medal time as the game shows it: 79 → "01:19", 82.5 → "01:22.50". */
export function medalTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const mm = String(Math.floor(whole / 60)).padStart(2, '0');
  const ss = String(whole % 60).padStart(2, '0');
  const frac = Math.round((seconds - whole) * 100);
  return frac > 0 ? `${mm}:${ss}.${String(frac).padStart(2, '0')}` : `${mm}:${ss}`;
}

/**
 * The planner mode for an event's vehicle. Arcade builds sit with the Campaign's and some carry Faulty parts, which only
 * Campaign allows, so Campaign is used wherever it has the vehicle; Podracers only exist in Multiplayer Tour.
 */
export function arcadeMode(data: PlannerData, e: ArcadeEvent): GameMode {
  return data.meta.modes.campaign.vehicles.includes(e.vehicle) ? 'campaign' : 'mp';
}

/** The event's vehicle as a planner build: its levels, parts and abilities, and no racer style. */
export function arcadeBuild(data: PlannerData, e: ArcadeEvent): Build {
  const levels = new Map<string, number | undefined>(Object.entries(e.levels));
  return {
    ...freshBuild(arcadeMode(data, e), data),
    vehicle: e.vehicle,
    style: null,
    levels: Object.fromEntries(data.slots.map((s) => [s.id, Math.min(MAX_LEVEL, levels.get(s.id) ?? 0)])),
    parts: e.parts.slice(0, data.meta.partSlots.max),
    abilities: fitAbilities(data, e.abilities),
  };
}

export interface ArcadeTab {
  id: string;
  name: string;
  events: ArcadeEvent[];
}

/** Events grouped by tab, tabs and events in the game's order. */
export function arcadeTabs(data: PlannerData): ArcadeTab[] {
  const tabs = new Map<string, ArcadeTab>();
  for (const e of data.arcade) {
    const tab = tabs.get(e.category) ?? { id: e.category, name: CATEGORY_NAMES[e.category] ?? e.category, events: [] };
    tab.events.push(e);
    tabs.set(e.category, tab);
  }
  return [...tabs.values()];
}

/** The event to earn a medal on first, when it's another Arcade event. */
export const unlockedBy = (data: PlannerData, e: ArcadeEvent): ArcadeEvent | undefined =>
  e.lockedBy === null ? undefined : data.arcade.find((x) => x.id === e.lockedBy);

/** Everything an Arcade card shows. */
export interface ArcadeCardView {
  event: ArcadeEvent;
  tab: string;
  type: string;
  vehicle: { name: string; icon: IconName | null };
  /** The planner link's build code. */
  code: string;
  stats: { id: SlotId; name: string; icon: IconName; level: number }[];
  /** Top speeds in km/h, rounded; Ramjet is null when the vehicle races without one. */
  speed: { top: number; afterburner: number; ramjet: number | null };
  parts: { name: string; icon: IconName | null; rarity: PartRarity }[];
  abilities: { name: string; icon: IconName | null }[];
  medals: { medal: Medal; time: string }[];
}

export function arcadeCard(data: PlannerData, e: ArcadeEvent): ArcadeCardView {
  const b = arcadeBuild(data, e);
  const s = speeds(data, b, evaluate(data, b));
  const vehicle = data.vehicles.find((v) => v.id === e.vehicle);
  return {
    event: e,
    tab: CATEGORY_NAMES[e.category] ?? e.category,
    type: TYPE_NAMES[e.type],
    vehicle: { name: vehicle?.name ?? e.vehicle, icon: vehicle?.icon ?? null },
    code: encodeBuild(b),
    stats: data.slots.map((slot) => ({ id: slot.id, name: slot.name, icon: slot.icon, level: b.levels[slot.id] ?? 0 })),
    speed: {
      top: Math.round(toKmh(s.top)),
      afterburner: Math.round(toKmh(s.top + s.afterburner)),
      ramjet: e.ramjet ? Math.round(toKmh(s.top + s.ramjet)) : null,
    },
    parts: b.parts.flatMap((id) => {
      const p = data.affixes.find((x) => x.id === id);
      return p ? [{ name: p.name, icon: p.icon, rarity: p.rarity }] : [];
    }),
    abilities: b.abilities.flatMap((id) => {
      const a = data.abilities.find((x) => x.id === id);
      return a ? [{ name: a.name, icon: a.icon }] : [];
    }),
    medals: e.medals.map((t, i) => ({ medal: MEDALS[i] ?? 'Bronze', time: medalTime(t) })),
  };
}
