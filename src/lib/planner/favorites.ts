// Favourite builds, kept in the browser. Each one is stored as its build code (ADR 0010), which stays valid across
// game patches, plus the name the player gave it. Saved data is untrusted, so it's validated when read.
import { z } from 'zod';
import type { IconName, PlannerData } from '../data/types.ts';
import type { Build } from '../engine/build.ts';
import { decodeBuild, encodeBuild } from '../engine/codes.ts';
import { evaluate } from '../engine/evaluate.ts';
import { speeds, toKmh } from '../engine/speeds.ts';
import { regularAbilities } from './actions.ts';

export const FAVORITES_KEY = 'swgr-favorites';
export const MAX_FAVORITES = 100;
const MAX_NAME = 60;

export interface Favorite {
  id: string;
  name: string;
  code: string;
  /** When it was saved (ms since the epoch); newest first. */
  savedAt: number;
}

/** What a favourite's row shows. */
export interface FavoriteSummary {
  vehicle: { name: string; icon: IconName };
  style: { name: string; icon: IconName };
  /** The regular abilities, up to four, in slot order (the crash ability isn't shown). */
  abilities: { name: string; icon: IconName }[];
  /** The faster boost and the top speed it reaches (km/h, rounded), with every on/off situational effect triggered. */
  boost: { kind: 'afterburner' | 'ramjet'; kmh: number };
}

export const BOOST_ICONS: Record<FavoriteSummary['boost']['kind'], IconName> = {
  afterburner: 'T_UI_Keyword_Afterburner_Icn' as IconName,
  ramjet: 'T_UI_Keyword_Ramjet_Icn' as IconName,
};

const Saved = z.object({
  version: z.literal(1),
  items: z.array(z.object({ id: z.string().min(1), name: z.string(), code: z.string().regex(/^gr2-/), savedAt: z.number() })),
});

/** Reads the saved list, dropping entries whose code no longer decodes. An unreadable list is empty. */
export function restoreFavorites(data: PlannerData, raw: unknown): Favorite[] {
  const r = Saved.safeParse(raw);
  if (!r.success) return [];
  return r.data.items.filter((f) => {
    try {
      decodeBuild(f.code, data);
      return true;
    } catch {
      return false;
    }
  });
}

export const saveFavorites = (list: readonly Favorite[]): string => JSON.stringify({ version: 1, items: list });

const cleanName = (name: string, fallback: string): string => name.trim().slice(0, MAX_NAME) || fallback;

/** A name to start from: "Firebug · Skim Speeder". */
export function defaultName(data: PlannerData, b: Build): string {
  const style = data.styles.find((s) => s.id === b.style)?.name ?? 'Build';
  const vehicle = data.vehicles.find((v) => v.id === b.vehicle)?.name ?? '';
  return vehicle ? `${style} · ${vehicle}` : style;
}

/** Adds a build to the top of the list. The same build saved again moves to the top under the new name. */
export function addFavorite(data: PlannerData, list: readonly Favorite[], b: Build, name: string, now: number, id: string): Favorite[] {
  const code = encodeBuild(b);
  const entry: Favorite = { id, name: cleanName(name, defaultName(data, b)), code, savedAt: now };
  return [entry, ...list.filter((f) => f.code !== code)].slice(0, MAX_FAVORITES);
}

export const renameFavorite = (list: readonly Favorite[], id: string, name: string): Favorite[] =>
  list.map((f) => (f.id === id ? { ...f, name: cleanName(name, f.name) } : f));

export const removeFavorite = (list: readonly Favorite[], id: string): Favorite[] => list.filter((f) => f.id !== id);

/** True when this build is already in the list. */
export const isFavorite = (list: readonly Favorite[], b: Build): boolean => {
  const code = encodeBuild(b);
  return list.some((f) => f.code === code);
};

/**
 * A build with every on/off situational effect triggered: the most it can reach without counting anything. Effects
 * counted per trigger, per second or per opponent hit stay at zero, since there's no single number to pick for them.
 */
export function allTriggered(data: PlannerData, b: Build): Build {
  const plain = { ...b, active: {} };
  const onOff = evaluate(data, plain).conditionals.filter((c) => !c.repeatable && c.perSecond === undefined);
  return { ...plain, active: Object.fromEntries(onOff.map((c) => [c.key, true as const])) };
}

/** The row's icons and readout. The speed is the build's best with every on/off situational effect triggered. */
export function summarize(data: PlannerData, f: Favorite): FavoriteSummary {
  const b = allTriggered(data, decodeBuild(f.code, data));
  const vehicle = data.vehicles.find((v) => v.id === b.vehicle);
  const style = data.styles.find((s) => s.id === b.style);
  const s = speeds(data, b, evaluate(data, b));
  const afterburner = toKmh(s.top + s.afterburner);
  const ramjet = toKmh(s.top + s.ramjet);
  return {
    vehicle: { name: vehicle?.name ?? '', icon: vehicle?.icon ?? ('' as IconName) },
    style: { name: style?.name ?? '', icon: style?.icon ?? ('' as IconName) },
    abilities: regularAbilities(data, b).flatMap((id) => {
      const a = data.abilities.find((x) => x.id === id);
      return a ? [{ name: a.name, icon: a.icon }] : [];
    }),
    boost: ramjet >= afterburner ? { kind: 'ramjet', kmh: Math.round(ramjet) } : { kind: 'afterburner', kmh: Math.round(afterburner) },
  };
}
