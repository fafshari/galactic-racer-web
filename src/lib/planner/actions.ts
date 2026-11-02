// Planner rules as pure functions: each takes a build and returns the next one (ADR 0008, 0012).
// Ported from the legacy planner's event handlers; the UI only calls these.
import type { Ability, AbilityId, FavourId, GameMode, OfferRarity, Part, PartId, PlannerData, SlotId, StyleId, VehicleId } from '../data/types.ts';
import { abilityAllowed, fitAbilities, freshBuild, isCrashAbility, MAX_LEVEL, partAllowed, stylesFor, type ActiveCount, type Build } from '../engine/build.ts';

export const maxParts = (data: PlannerData): number => data.meta.partSlots.max;
/** Regular ability slots; the crash ability has a slot of its own on top. */
export const maxAbilities = (data: PlannerData): number => data.meta.abilitySlots;

/** Which slot an ability goes in. */
export type AbilitySlotKind = 'regular' | 'crash';
const slotOf = (data: PlannerData, id: AbilityId): AbilitySlotKind => {
  const a = byId(data.abilities, id);
  return a && isCrashAbility(a) ? 'crash' : 'regular';
};
/** The regular abilities, in slot order. */
export const regularAbilities = (data: PlannerData, b: Build): AbilityId[] => b.abilities.filter((id) => slotOf(data, id) === 'regular');
/** The crash ability, if one is installed. */
export const crashAbility = (data: PlannerData, b: Build): AbilityId | undefined => b.abilities.find((id) => slotOf(data, id) === 'crash');

/** The effect only applies in some situations ("while Surging", "after a takedown"). */
export const isSituational = (p: { rules: Part['rules'] }): boolean => p.rules.some((r) => r.requires.length > 0 || r.effects.length > 0);

// ---- part families ---------------------------------------------------------------------------------
/** Parts sharing a family are one effect at different rarities; one-offs are their own family. */
export const familyKey = (p: Part): string => (p.family === null ? p.id : `f${String(p.family)}`);

export function familyOf(data: PlannerData, p: Part, mode: GameMode): Part[] {
  return p.family === null ? [p] : data.affixes.filter((x) => x.family === p.family && partAllowed(x, mode));
}

/** "Afterburner Efficiency II" → "Afterburner Efficiency" when the family has several rarities. */
export function familyName(data: PlannerData, p: Part): string {
  return p.family !== null && data.affixes.some((x) => x.family === p.family && x.id !== p.id) ? p.name.replace(/\s+(?:I|II|III|IV|V)$/, '') : p.name;
}

export const offerRarity = (p: Part): OfferRarity | null => (p.rarity === 'Faulty' ? null : p.rarity);

/** Picker rows: one per family that matches the search, each showing its lowest-rarity member by default. */
export function partFamilies(data: PlannerData, mode: GameMode, query: string): Part[][] {
  const q = query.trim().toLowerCase();
  const seen = new Map<string, Part[]>();
  for (const p of data.affixes) {
    if (!partAllowed(p, mode)) continue;
    const k = familyKey(p);
    const list = seen.get(k);
    if (list) list.push(p);
    else seen.set(k, [p]);
  }
  return [...seen.values()]
    .filter((fam) => !q || fam.some((p) => `${p.name} ${p.desc}`.toLowerCase().includes(q)))
    .map((fam) => ({ fam, name: fam[0] ? familyName(data, fam[0]) : '' }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((x) => x.fam);
}

// ---- build changes -----------------------------------------------------------------------------------
const byId = <T extends { id: string }>(list: readonly T[], id: string): T | undefined => list.find((x) => x.id === id);

/** Switches mode, keeping what still applies: the same-named style, allowed vehicle, abilities and parts. */
export function setMode(data: PlannerData, b: Build, mode: GameMode): Build {
  if (b.mode === mode) return b;
  const old = byId(data.styles, b.style);
  const styles = stylesFor(mode, data);
  const style = styles.find((s) => s.name === old?.name && (s.rank ?? 1) === 1) ?? styles[0];
  if (!style) return b;
  const vehicles = data.meta.modes[mode].vehicles;
  const keepAbilities = b.abilities.filter((id) => {
    const a = byId(data.abilities, id);
    return !style.abilities.includes(id) && a !== undefined && abilityAllowed(a, mode);
  });
  return {
    ...b,
    mode,
    vehicle: vehicles.includes(b.vehicle) ? b.vehicle : (vehicles[0] ?? b.vehicle),
    style: style.id,
    abilities: fitAbilities(data, [...style.abilities, ...keepAbilities]),
    parts: b.parts.filter((id) => {
      const p = byId(data.affixes, id);
      return p !== undefined && partAllowed(p, mode);
    }),
    favours: mode === 'mp' ? [] : b.favours,
    active: {},
  };
}

export const setVehicle = (b: Build, vehicle: VehicleId): Build => ({ ...b, vehicle, active: {} });

/** Picks a style group; Campaign keeps the current rank. The old style's starting abilities make way for the new one's. */
export function setStyle(data: PlannerData, b: Build, picked: StyleId): Build {
  const old = byId(data.styles, b.style);
  const p = byId(data.styles, picked);
  if (!p) return b;
  const style = (old?.rank != null ? data.styles.find((s) => s.group === p.group && s.rank === old.rank) : undefined) ?? p;
  const kept = b.abilities.filter((a) => !(old?.abilities.includes(a) ?? false) && !style.abilities.includes(a));
  return { ...b, style: style.id, abilities: fitAbilities(data, [...style.abilities, ...kept]), active: {} };
}

/** Campaign ranks of the current style, lowest first; empty for Multiplayer styles. */
export function ranksOf(data: PlannerData, b: Build) {
  const s = byId(data.styles, b.style);
  return s?.rank != null ? data.styles.filter((x) => x.group === s.group).sort((x, y) => (x.rank ?? 0) - (y.rank ?? 0)) : [];
}

export const setRank = (b: Build, style: StyleId): Build => ({ ...b, style, active: {} });

export const setLevel = (b: Build, slot: SlotId, level: number): Build => ({
  ...b,
  levels: { ...b.levels, [slot]: Math.max(0, Math.min(MAX_LEVEL, Math.round(level))) },
});

export const powerOf = (data: PlannerData, b: Build): number =>
  data.slots.reduce((n, s) => n + (s.levels[b.levels[s.id] ?? 0]?.power ?? 0), 0);

/**
 * Puts an ability in a slot. A crash ability goes in the crash slot, replacing the one there. A regular one replaces
 * what's in regular slot `slot`, or fills the next free regular slot. No duplicates.
 */
export function placeAbility(data: PlannerData, b: Build, id: AbilityId, slot: number): Build {
  if (b.abilities.includes(id)) return b;
  if (slotOf(data, id) === 'crash') return { ...b, abilities: [...regularAbilities(data, b), id] };
  const regular = regularAbilities(data, b);
  if (slot < regular.length) regular[slot] = id;
  else if (regular.length < maxAbilities(data)) regular.push(id);
  else return b;
  const crash = crashAbility(data, b);
  return { ...b, abilities: crash === undefined ? regular : [...regular, crash] };
}

export const removeAbility = (b: Build, id: AbilityId): Build => ({ ...b, abilities: b.abilities.filter((x) => x !== id) });

/** Abilities a slot can take: regular slots take regular abilities, the crash slot takes crash abilities. */
export function abilityChoices(data: PlannerData, mode: GameMode, slot: AbilitySlotKind, level: Ability['level'] | 'all', query: string): Ability[] {
  const q = query.trim().toLowerCase();
  return data.abilities.filter(
    (a) =>
      abilityAllowed(a, mode) &&
      isCrashAbility(a) === (slot === 'crash') &&
      (level === 'all' || a.level === level) &&
      (!q || `${a.name} ${a.desc}`.toLowerCase().includes(q)),
  );
}

/** Why a part can't be added right now, or null if it can. */
export function cannotAddPart(data: PlannerData, b: Build, p: Part): 'in-build' | 'full' | null {
  const owned = b.parts.some((id) => {
    const o = byId(data.affixes, id);
    return o !== undefined && familyKey(o) === familyKey(p);
  });
  if (owned) return 'in-build';
  if (b.parts.length >= maxParts(data)) return 'full';
  return null;
}

/** Adds a part. A build holds one rarity per part family (ADR 0009). */
export function addPart(data: PlannerData, b: Build, id: PartId): Build {
  const p = byId(data.affixes, id);
  if (!p || cannotAddPart(data, b, p) !== null) return b;
  return { ...b, parts: [...b.parts, id] };
}

/** Re-keys counted situational effects from one owner id to another. */
function moveActive(active: Build['active'], from: string, to: string): Build['active'] {
  return Object.fromEntries(Object.entries(active).map(([k, v]) => [k.startsWith(`${from}#`) ? to + k.slice(from.length) : k, v]));
}

/** Switches an installed part to another rarity of the same effect, keeping its situational settings. */
export function swapPart(data: PlannerData, b: Build, index: number, to: PartId): Build {
  const from = b.parts[index];
  const a = from === undefined ? undefined : byId(data.affixes, from);
  const t = byId(data.affixes, to);
  if (from === undefined || !a || !t || from === to || familyKey(a) !== familyKey(t)) return b;
  return { ...b, parts: b.parts.map((id, i) => (i === index ? to : id)), active: moveActive(b.active, from, to) };
}

export const removePart = (b: Build, index: number): Build => ({ ...b, parts: b.parts.filter((_, i) => i !== index) });

/** Adds a favour, replacing any other rank of the same favour. */
export function addFavour(data: PlannerData, b: Build, id: FavourId): Build {
  const f = byId(data.favours, id);
  if (!f || b.mode !== 'campaign') return b;
  return { ...b, favours: [...b.favours.filter((x) => byId(data.favours, x)?.group !== f.group), id] };
}

export const removeFavour = (b: Build, index: number): Build => ({ ...b, favours: b.favours.filter((_, i) => i !== index) });

/** Counts (or stops counting) a situational effect. */
export function setActive(b: Build, key: string, value: ActiveCount | undefined): Build {
  const rest = Object.fromEntries(Object.entries(b.active).filter(([k]) => k !== key));
  return { ...b, active: value === undefined ? rest : { ...rest, [key]: value } };
}

export { freshBuild };
