// The tour in progress, kept between visits. Saved data is untrusted: anything that doesn't fit is dropped.
import { z } from 'zod';
import type { PlannerData } from '../data/types.ts';
import type { TourState } from './tour.ts';

export const TOUR_STORAGE_KEY = 'swgr-tour-v2';

const Saved = z.object({
  version: z.literal(1),
  state: z.looseObject({
    phase: z.enum(['setup', 'backer', 'bet', 'race', 'rewards', 'shop', 'done']),
    vehicle: z.string(),
    style: z.string(),
    seed: z.number(),
    planet: z.number().int().nonnegative(),
    parts: z.array(z.string()),
    abilities: z.array(z.string()),
    log: z.array(z.object({ planet: z.number(), text: z.string(), amount: z.number() })),
  }),
});

export const saveTour = (s: TourState): string => JSON.stringify({ version: 1, state: s });

/** A saved run, if it's from this version and everything it refers to still exists. */
export function restoreTour(data: PlannerData, raw: unknown): TourState | null {
  const r = Saved.safeParse(raw);
  if (!r.success) return null;
  const s = r.data.state;
  const ok =
    data.vehicles.some((v) => v.id === s.vehicle) &&
    data.styles.some((x) => x.id === s.style && x.mode === 'mp') &&
    s.planet < data.tour.planets.length &&
    s.parts.every((id) => data.affixes.some((p) => p.id === id)) &&
    s.abilities.every((id) => data.abilities.some((a) => a.id === id));
  if (!ok) return null;
  // The shape was checked above and every id resolves, so this is the state saveTour wrote. Runs saved before the
  // final race bet and EXP existed get their starting values.
  const fresh: Pick<TourState, 'finalPick' | 'finalBackers' | 'xp'> = { finalPick: null, finalBackers: 1, xp: { races: 0, bets: 0, finalBet: 0, league: 0 } };
  return { ...fresh, ...(s as unknown as TourState) };
}
