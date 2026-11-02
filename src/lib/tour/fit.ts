// "Best fit" / "Good fit" labels for a set of offers, from the synergy scorer (ported from the legacy simulator).
import type { SlotId } from '../data/types.ts';
import { MIN_FIT, type OfferKind, type Synergy } from '../synergy/synergy.ts';
import type { TourState } from './tour.ts';

export type FitKind = OfferKind | 'upgrade';

export interface Fit {
  label: 'Best fit' | 'Good fit' | null;
  reason: string;
}

/**
 * Rates offers against the run's build: the top score is the best fit, anything within 80% of it a good fit.
 * Parts and abilities must clear the fit line to be labelled at all; upgrades follow the style's own priority.
 */
export function rateOffers(synergy: Synergy, s: TourState, kind: FitKind, ids: readonly string[]): Map<string, Fit> {
  const build = { style: s.style, abilities: s.abilities, parts: s.parts, levels: s.levels as Partial<Record<SlotId, number>> };
  const profile = synergy.profile(build);
  const rated = ids.map((id) => ({ id, ...(kind === 'upgrade' ? synergy.scoreUpgrade(id as SlotId, build) : synergy.score(kind, id, build, profile)) }));
  const best = Math.max(0, ...rated.map((r) => r.score));
  const floor = kind === 'upgrade' ? 0 : MIN_FIT;
  return new Map(
    rated.map((r) => {
      const label = best > floor && r.score === best ? 'Best fit' : best > floor && r.score >= best * 0.8 && r.score >= floor ? 'Good fit' : null;
      return [r.id, { label, reason: r.reason }];
    }),
  );
}
