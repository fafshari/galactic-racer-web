import { describe, expect, it } from 'vitest';
import { planner } from '../data/index.ts';
import type { OfferRarity, Part, PartId } from '../data/types.ts';
import { createRng } from './random.ts';
import { abilityParent, formRank, isUnderdog, newTour, packPrice, partTier, rerollPrice, tourAction, type TourAction, type TourState } from './tour.ts';

const T = planner.tour;
const RANK: OfferRarity[] = ['Common', 'Rare', 'Epic', 'Legendary'];
const part = (id: string): Part => {
  const p = planner.affixes.find((x) => x.id === id);
  if (!p) throw new Error(`no part ${id}`);
  return p;
};
const run = (state: TourState, ...actions: TourAction[]): TourState => actions.reduce((s, a) => tourAction(planner, s, a).state, state);
const started = (seed = 1234): TourState => run(newTour(planner, seed), { type: 'start' });

/** Plays a whole tour with simple choices; returns every state along the way. */
function playTour(seed: number): TourState[] {
  const seen: TourState[] = [];
  let s = started(seed);
  const go = (a: TourAction): void => {
    s = tourAction(planner, s, a).state;
    seen.push(s);
  };
  for (let guard = 0; s.phase !== 'done' && guard < 400; guard++) {
    if (s.phase === 'backer') {
      go({ type: 'pickBacker', index: 0 });
      go({ type: 'goTo', phase: 'bet' });
    } else if (s.phase === 'bet') {
      go({ type: 'pickBet', id: T.risk[0]?.id ?? '' });
      go({ type: 'goTo', phase: 'race' });
    } else if (s.phase === 'race') {
      go({ type: 'setFinish', position: 1 + (s.planet % 4) });
      go({ type: 'setUnits', n: 3 });
      go({ type: 'finishRace' });
    } else if (s.phase === 'rewards') {
      const id = s.offer?.ids[0];
      if (id) go({ type: 'takeReward', id });
      else go({ type: 'skipReward' });
    } else if (s.phase === 'shop') {
      const buy = s.shop?.parts.find((id) => s.credits >= T.prices.part[partTier(part(id))]);
      if (buy) go({ type: 'buyPart', id: buy });
      go({ type: 'leaveShop' });
    }
  }
  return seen;
}

describe('a whole tour', () => {
  it('plays through all six planets to the end', () => {
    const states = playTour(42);
    const end = states.at(-1);
    expect(end?.phase).toBe('done');
    expect(end?.planet).toBe(T.planets.length - 1);
  });

  it('keeps the books balanced: credits = starting + earned − spent', () => {
    for (const s of playTour(7)) expect(s.credits).toBeCloseTo(T.prices.startingCredits + s.earned - s.spent);
  });

  it('is deterministic: the same seed and choices give the same run', () => {
    expect(JSON.stringify(playTour(99))).toBe(JSON.stringify(playTour(99)));
    expect(JSON.stringify(playTour(99))).not.toBe(JSON.stringify(playTour(100)));
  });

  it('replays a seed from the start', () => {
    const a = playTour(5).at(-1);
    if (!a) throw new Error('no run');
    const replayed = tourAction(planner, a, { type: 'replay' }).state;
    expect([replayed.phase, replayed.racers, replayed.backers]).toEqual([started(5).phase, started(5).racers, started(5).backers]);
  });

  it('never goes over the slot limits', () => {
    for (const s of playTour(3)) {
      expect(s.parts.length).toBeLessThanOrEqual(planner.meta.partSlots.max);
      expect(s.abilities.length).toBeLessThanOrEqual(planner.meta.abilitySlots);
    }
  });
});

describe('the start', () => {
  it('starts with the style, credits and a backer choice', () => {
    const s = started();
    const style = planner.styles.find((x) => x.id === s.style);
    expect(s.phase).toBe('backer');
    expect(s.credits).toBe(T.prices.startingCredits);
    expect(s.abilities).toEqual(style?.abilities);
    expect(s.backers).toHaveLength(T.backers.length);
    expect(s.racers).toHaveLength(11);
  });
});

describe('backers', () => {
  /** Plays the first race picking backer `pick`, then skips to the next planet's backer choice. */
  const toPlanetTwo = (seed: number, pick: number): TourState => {
    let s = run(started(seed), { type: 'pickBacker', index: pick }, { type: 'goTo', phase: 'bet' }, { type: 'pickBet', id: T.risk[0]?.id ?? '' }, { type: 'goTo', phase: 'race' }, { type: 'setFinish', position: 6 }, { type: 'finishRace' });
    for (let guard = 0; s.phase === 'rewards' && guard < 10; guard++) s = run(s, { type: 'skipReward' });
    return run(s, { type: 'leaveShop' });
  };

  it('offers every backer at the first race', () => {
    expect(started().backers.map((o) => o.backer)).toEqual(T.backers.map((_, i) => i));
  });

  it('from the second race on, offers three different contracts from the backer picked first', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const [pick] of T.backers.entries()) {
        const s = toPlanetTwo(seed, pick);
        expect(s.planet).toBe(1);
        expect(s.phase).toBe('backer');
        expect(s.backers).toHaveLength(3);
        expect(s.backers.every((o) => o.backer === pick)).toBe(true);
        expect(new Set(s.backers.map((o) => o.contract)).size).toBe(3);
      }
    }
  });

  it('keeps that backer for the whole tour', () => {
    const states = playTour(42);
    const first = started(42).backers[0]?.backer;
    const later = states.filter((s) => s.phase === 'backer' && s.planet > 0);
    expect(new Set(later.map((s) => s.planet)).size).toBe(T.planets.length - 1);
    for (const s of later) expect(s.backers.every((o) => o.backer === first)).toBe(true);
  });
});

describe('races', () => {
  const toRace = (seed = 1): TourState =>
    run(started(seed), { type: 'pickBacker', index: 0 }, { type: 'goTo', phase: 'bet' }, { type: 'pickBet', id: T.risk[0]?.id ?? '' }, { type: 'goTo', phase: 'race' });

  it('pays base, placing and contract credits', () => {
    const s0 = toRace();
    const o = s0.backers[0];
    const c = o ? T.backers[o.backer]?.contracts[o.contract] : undefined;
    const p = T.planets[0];
    if (!c || !p) throw new Error('fixtures missing');
    const s = run(s0, { type: 'setFinish', position: 2 }, { type: 'setUnits', n: 4 }, { type: 'finishRace' });
    expect(s.earned).toBeCloseTo(p.baseCredits + (p.placeCredits[1] ?? 0) + 4 * c.perUnit);
  });

  it('scores form for your finish and a won bet; the rivals fill the other places', () => {
    const bet = T.risk[0];
    if (!bet) throw new Error('no bets');
    const s = run(toRace(), { type: 'setFinish', position: 1 }, { type: 'finishRace' });
    expect(s.form.you).toBe((T.form.positionScore[0] ?? 0) + (T.form.betScore[bet.id] ?? 0));
    const places = s.racers.map((r) => r.finishes[0]).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(places).toEqual(Array.from({ length: 11 }, (_, i) => i + 2));
  });

  it('queues an upgrade, and on a won bet a part reward with one guaranteed rarity', () => {
    for (const bet of T.risk) {
      for (let seed = 1; seed <= 20; seed++) {
        const s = run(toRace(seed), { type: 'goTo', phase: 'bet' }, { type: 'pickBet', id: bet.id }, { type: 'goTo', phase: 'race' }, { type: 'setFinish', position: 1 }, { type: 'finishRace' });
        expect(s.queue.map((q) => q.kind)).toEqual(['upgrade', 'betPart']);
        const afterUpgrade = run(s, { type: 'takeReward', id: s.offer?.ids[0] ?? '' });
        expect(afterUpgrade.offer?.kind).toBe('part');
        const rarities = (afterUpgrade.offer?.ids ?? []).map((id) => RANK.indexOf(partTier(part(id))));
        expect(Math.max(...rarities)).toBeGreaterThanOrEqual(RANK.indexOf(bet.minRarity));
      }
    }
  });

  it("is never the Underdog on the first planet, and the player's own reading wins", () => {
    const s = toRace();
    expect(isUnderdog(planner, s)).toBe(false);
    expect(isUnderdog(planner, { ...s, underdogOverride: true })).toBe(true);
    expect(formRank({ ...s, form: { you: 5, field: [1, 2, 9, 9, 9, 9, 9, 9, 9, 9, 9] } })).toEqual({ place: 10, below: 2, score: 5 });
  });
});

describe('the shop', () => {
  const inShop = (seed = 11): TourState => {
    let s = started(seed);
    for (let guard = 0; s.phase !== 'shop' && guard < 50; guard++) {
      if (s.phase === 'backer') s = run(s, { type: 'goTo', phase: 'bet' });
      else if (s.phase === 'bet') s = run(s, { type: 'pickBet', id: T.risk.at(-1)?.id ?? '' }, { type: 'goTo', phase: 'race' });
      else if (s.phase === 'race') s = run(s, { type: 'setFinish', position: 12 }, { type: 'finishRace' });
      else if (s.phase === 'rewards') s = run(s, { type: 'skipReward' });
    }
    return { ...s, credits: 1e9 };
  };

  it('offers the shop size of parts, and rerolls cost more each time', () => {
    let s = inShop();
    expect(s.shop?.parts.length).toBe(T.shop.parts);
    for (let i = 0; i < 3; i++) {
      const before = s.shop ? rerollPrice(planner, s.shop) : 0;
      expect(before).toBe(T.prices.reroll + T.prices.rerollIncrease * i);
      s = run(s, { type: 'reroll' });
      expect(s.spent).toBeGreaterThan(0);
    }
  });

  it('packs cost more each time and offer only stats that can still go up', () => {
    let s = inShop();
    s = { ...s, levels: { ...s.levels, Cornering: 10, Acceleration: 10 } };
    const price = s.shop ? packPrice(planner, s.shop, 'stat') : 0;
    s = run(s, { type: 'openPack', kind: 'stat' });
    expect(s.shop?.pack?.kind).toBe('stat');
    expect(s.shop?.pack?.ids).not.toContain('Cornering');
    expect(s.shop?.pack?.ids).not.toContain('Acceleration');
    const id = s.shop?.pack?.ids[0] ?? '';
    s = run(s, { type: 'takePack', id });
    expect(s.shop && packPrice(planner, s.shop, 'stat')).toBe(price + T.prices.partPackIncrease);
  });

  it('ability packs offer new Level 1s or the next step of a line you own, never a line you have', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = run(inShop(seed), { type: 'openPack', kind: 'ability' });
      const pack = s.shop?.pack;
      if (pack?.kind !== 'ability') continue;
      for (const id of pack.ids) {
        expect(s.abilities).not.toContain(id);
        const parent = abilityParent(planner, id);
        if (parent) expect(s.abilities).toContain(parent);
      }
    }
  });
});

describe('the part-family rule (ADR 0009)', () => {
  const family = planner.affixes.filter((p) => p.mp.length && p.family !== null && p.family === planner.affixes.find((x) => x.name === 'Faster Attachments II')?.family);
  const rare = family.find((p) => p.rarity === 'Rare');
  const epic = family.find((p) => p.rarity === 'Epic');
  if (!rare || !epic) throw new Error('fixtures missing');

  it('never offers your own or a lower rarity of a part you own', () => {
    let lowerOrSame = 0;
    let higher = 0;
    for (let seed = 1; seed <= 60; seed++) {
      let s: TourState = { ...newTour(planner, seed), phase: 'shop', parts: [rare.id], credits: 1e9 };
      s = { ...s, shop: { rerolls: 0, partPacks: 0, abilityPacks: 0, sold: [], parts: [], pack: null } };
      for (let i = 0; i < 10; i++) {
        s = run(s, { type: 'reroll' });
        for (const id of s.shop?.parts ?? []) {
          const p = part(id);
          if (p.family !== rare.family) continue;
          if (RANK.indexOf(partTier(p)) <= RANK.indexOf('Rare')) lowerOrSame++;
          else higher++;
        }
      }
    }
    expect(lowerOrSame).toBe(0);
    expect(higher).toBeGreaterThan(0);
  });

  it('a higher rarity replaces the owned part in its slot, even with every slot full', () => {
    const others = planner.affixes.filter((p) => p.mp.length && p.family === null && p.rarity !== 'Faulty').slice(0, planner.meta.partSlots.max - 1).map((p) => p.id);
    const full: TourState = { ...newTour(planner, 1), phase: 'shop', credits: 1e9, parts: [...others, rare.id], shop: { rerolls: 0, partPacks: 0, abilityPacks: 0, sold: [], parts: [epic.id], pack: null } };
    const s = run(full, { type: 'buyPart', id: epic.id });
    expect(s.parts).toHaveLength(planner.meta.partSlots.max);
    expect(s.parts).toContain(epic.id);
    expect(s.parts).not.toContain(rare.id);
    expect(s.log[1]?.text).toBe(`Upgraded ${rare.name} to ${epic.name}`);
  });

  it('a new part needs a free slot', () => {
    const others = planner.affixes.filter((p) => p.mp.length && p.family === null && p.rarity !== 'Faulty').slice(0, planner.meta.partSlots.max).map((p) => p.id);
    const extra = planner.affixes.find((p) => p.mp.length && p.family === null && !others.includes(p.id))?.id ?? ('x' as PartId);
    const full: TourState = { ...newTour(planner, 1), phase: 'shop', credits: 1e9, parts: others, shop: { rerolls: 0, partPacks: 0, abilityPacks: 0, sold: [], parts: [extra], pack: null } };
    const r = tourAction(planner, full, { type: 'buyPart', id: extra });
    expect(r.state.parts).toEqual(others);
    expect(r.message).toBe(`All ${String(planner.meta.partSlots.max)} part slots are full.`);
  });
});

describe('random', () => {
  it('matches the legacy generator', () => {
    const r = createRng(1);
    const first = [r(), r(), r()].map((x) => x.toFixed(6));
    // values from the legacy simulator's mulberry32 with seed 1
    expect(first).toEqual(['0.627074', '0.002736', '0.527447']);
  });

  it('ability upgrade lines come from the data', () => {
    const upgrade = planner.abilities.find((a) => a.level === 'Level2');
    if (!upgrade) throw new Error('no Level 2 ability');
    expect(abilityParent(planner, upgrade.id)).toBeDefined();
  });
});
