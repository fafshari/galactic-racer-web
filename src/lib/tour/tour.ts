// The Multiplayer Tour simulation (ADR 0008, 0009), ported from the legacy tour simulator.
//
// The state is plain JSON (saved between visits) and every action returns the next state, so a run is a pure
// function of its seed and the choices made. Rolls draw from a generator seeded with seed + rolls × 7919,
// exactly as the legacy simulator did.
import type { AbilityId, OfferRarity, Part, PartId, PlannerData, SlotId, StyleId, VehicleId } from '../data/types.ts';
import { MAX_LEVEL, type Build } from '../engine/build.ts';
import { createRng, gauss, pickOne, pickWeighted, type Rng } from './random.ts';

export type Phase = 'setup' | 'backer' | 'bet' | 'race' | 'rewards' | 'shop' | 'done';

/** One backer's offer this race: indexes into tour.backers and its contracts. */
export interface BackerOffer {
  backer: number;
  contract: number;
}

/** A reward waiting to be chosen after a race. */
export type QueueItem =
  | { kind: 'upgrade'; title: string; note: string; skippable: boolean }
  | { kind: 'betPart'; title: string; note: string; bet: string };

export type Offer = { kind: 'upgrade'; ids: SlotId[] } | { kind: 'part'; ids: PartId[]; skip: number };

export type Pack = { kind: 'stat'; ids: SlotId[] } | { kind: 'ability'; ids: AbilityId[] };

export interface Shop {
  rerolls: number;
  partPacks: number;
  abilityPacks: number;
  /** Part ids bought from this shop's offers. */
  sold: PartId[];
  parts: PartId[];
  pack: Pack | null;
}

export interface LogEntry {
  /** Planet number, from 1. */
  planet: number;
  text: string;
  /** Credits gained (positive) or spent (negative); 0 for events. */
  amount: number;
}

/** One of the 11 simulated rivals: a hidden strength (0–10) and its finishing positions so far. */
export interface Racer {
  name: string;
  strength: number;
  finishes: number[];
}

export interface TourState {
  phase: Phase;
  vehicle: VehicleId;
  style: StyleId;
  /** Assumed: how many options each reward or pack shows. */
  options: number;
  /** Assumed: how many levels a race reward upgrade adds. Bought Upgrade Packs always add PACK_UPGRADE. */
  upgradeSize: number;
  seed: number;
  rolls: number;
  planet: number;
  credits: number;
  earned: number;
  spent: number;
  levels: Record<string, number>;
  parts: PartId[];
  abilities: AbilityId[];
  backers: BackerOffer[];
  backer: number | null;
  contractUnits: number;
  bet: string | null;
  finish: number | null;
  queue: QueueItem[];
  offer: Offer | null;
  shop: Shop | null;
  /** Newest first. */
  log: LogEntry[];
  form: { you: number; field: number[] };
  /** The player's own reading of the game's Underdog label, when it differs from the simulation's. */
  underdogOverride: boolean | null;
  racers: Racer[];
}

export type TourAction =
  | { type: 'setVehicle'; id: VehicleId }
  | { type: 'setStyle'; id: StyleId }
  | { type: 'setOptions'; n: number }
  | { type: 'setUpgradeSize'; n: number }
  | { type: 'start' }
  | { type: 'pickBacker'; index: number }
  | { type: 'goTo'; phase: 'backer' | 'bet' | 'race' }
  | { type: 'pickBet'; id: string }
  | { type: 'setFinish'; position: number }
  | { type: 'setUnits'; n: number }
  | { type: 'setUnderdog'; value: boolean }
  | { type: 'finishRace' }
  | { type: 'takeReward'; id: string }
  | { type: 'skipReward' }
  | { type: 'buyPart'; id: PartId }
  | { type: 'openPack'; kind: Pack['kind'] }
  | { type: 'takePack'; id: string }
  | { type: 'reroll' }
  | { type: 'leaveShop' }
  | { type: 'removeAbility'; index: number }
  | { type: 'removePart'; index: number }
  | { type: 'newRun'; seed: number }
  | { type: 'replay' };

export interface TourResult {
  state: TourState;
  /** Something to tell the player, e.g. why an action didn't happen. */
  message?: string;
}

/** A bought Upgrade Pack adds one level, whatever the race rewards' assumed size. */
export const PACK_UPGRADE = 1;
export const RACERS = 11;
export const POSITIONS = 12;
const RANK: readonly OfferRarity[] = ['Common', 'Rare', 'Epic', 'Legendary'];
/** How far a rival's race result swings around its strength. */
const SWING = 1.3;

export const credits = (n: number): string => `${Math.round(n).toLocaleString('en-US')} cr`;
export const partTier = (p: Part): OfferRarity => (p.rarity === 'Faulty' ? 'Common' : p.rarity);

// ---- setup -------------------------------------------------------------------------------------------
export function newTour(data: PlannerData, seed: number, keep: Partial<Pick<TourState, 'vehicle' | 'style' | 'options' | 'upgradeSize'>> = {}): TourState {
  const style = data.styles.find((s) => s.mode === 'mp');
  const vehicle = data.vehicles[0];
  if (!style || !vehicle) throw new Error('no Multiplayer styles or vehicles in the data');
  return {
    phase: 'setup',
    vehicle: keep.vehicle ?? vehicle.id,
    style: keep.style ?? style.id,
    options: keep.options ?? 3,
    upgradeSize: keep.upgradeSize ?? 1,
    seed: seed >>> 0,
    rolls: 0,
    planet: 0,
    credits: 0,
    earned: 0,
    spent: 0,
    levels: {},
    parts: [],
    abilities: [],
    backers: [],
    backer: null,
    contractUnits: 0,
    bet: null,
    finish: null,
    queue: [],
    offer: null,
    shop: null,
    log: [],
    form: { you: 0, field: Array<number>(RACERS).fill(0) },
    underdogOverride: null,
    racers: [],
  };
}

// ---- read-only helpers the page uses -------------------------------------------------------------------
export const planetOf = (data: PlannerData, s: TourState) => data.tour.planets[s.planet];
export const contractOf = (data: PlannerData, o: BackerOffer) => data.tour.backers[o.backer]?.contracts[o.contract];
/** True from the second race on: you stay with the backer you picked first, which offers several of its contracts. */
export const backerLocked = (s: Pick<TourState, 'backers'>): boolean => {
  const first = s.backers[0];
  return first !== undefined && s.backers.length > 1 && s.backers.every((o) => o.backer === first.backer);
};
export const unitLabel = (units: string): string => (units === 's' ? 'seconds' : units || 'actions');
export const singular = (u: string): string => u.replace(/ies$/, 'y').replace(/([^s])s$/, '$1');

export function formRank(s: TourState): { place: number; below: number; score: number } {
  const below = s.form.field.filter((x) => x < s.form.you).length;
  const tiedOrBelow = s.form.field.filter((x) => x <= s.form.you).length;
  return { place: POSITIONS - tiedOrBelow, below, score: s.form.you };
}

/** You're an Underdog when your form is among the lowest few (AI included), from the second planet on. */
export function isUnderdog(data: PlannerData, s: TourState): boolean {
  return s.underdogOverride ?? (s.planet > 0 && formRank(s).below < data.tour.form.underdogs);
}

export const racerTier = (strength: number): string =>
  strength >= 7.5 ? 'Front-runner' : strength >= 4.5 ? 'Midfield' : strength >= 2 ? 'Back' : 'Backmarker';

export const rerollPrice = (data: PlannerData, shop: Shop): number => data.tour.prices.reroll + data.tour.prices.rerollIncrease * shop.rerolls;
export const packPrice = (data: PlannerData, shop: Shop, kind: Pack['kind']): number =>
  kind === 'stat'
    ? data.tour.prices.partPack + data.tour.prices.partPackIncrease * shop.partPacks
    : data.tour.prices.abilityPack + data.tour.prices.abilityPackIncrease * shop.abilityPacks;
export const partPrice = (data: PlannerData, p: Part): number => data.tour.prices.part[partTier(p)];

const partById = (data: PlannerData, id: string): Part | undefined => data.affixes.find((p) => p.id === id);

/** The slot of an owned part from the same family, or -1. */
export function ownedSlotOf(data: PlannerData, s: TourState, p: Part | undefined): number {
  if (p?.family == null) return -1;
  return s.parts.findIndex((id) => partById(data, id)?.family === p.family);
}

/** Taking this part upgrades an owned part of the same family (a higher rarity takes its slot). */
export function replaces(data: PlannerData, s: TourState, id: PartId): boolean {
  const p = partById(data, id);
  const i = ownedSlotOf(data, s, p);
  const owned = i < 0 ? undefined : partById(data, s.parts[i] ?? '');
  return p !== undefined && owned !== undefined && RANK.indexOf(partTier(p)) > RANK.indexOf(partTier(owned));
}

/** The ability this one upgrades (from the game's CanUpgradeTo), if any. */
export function abilityParent(data: PlannerData, id: AbilityId): AbilityId | undefined {
  return data.abilities.find((a) => a.upgradesTo.includes(id))?.id;
}

export const isAbilityUpgrade = (data: PlannerData, s: TourState, id: AbilityId): boolean => {
  const parent = abilityParent(data, id);
  return parent !== undefined && s.abilities.includes(parent);
};

/** The run's build, in the planner's terms (for the engine and for opening it in the planner). */
export function buildOf(s: TourState): Build {
  return { mode: 'mp', vehicle: s.vehicle, style: s.style, levels: s.levels, parts: s.parts, abilities: s.abilities, favours: [], active: {} };
}

export interface Standing {
  name: string;
  you: boolean;
  tier: string;
  finishes: number[];
  form: number;
  underdog: boolean;
}

/** Everyone ranked by form; the bottom few are Underdogs from the second planet on. */
export function standings(data: PlannerData, s: TourState): Standing[] {
  const yourFinishes = s.log.filter((l) => l.text.startsWith('Finished P')).map((l) => Number(/P(\d+)/.exec(l.text)?.[1] ?? 0)).reverse();
  const rows = [
    { name: 'You', you: true, tier: '', finishes: yourFinishes, form: s.form.you },
    ...s.racers.map((r, i) => ({ name: r.name, you: false, tier: racerTier(r.strength), finishes: r.finishes, form: s.form.field[i] ?? 0 })),
  ].sort((a, b) => b.form - a.form);
  return rows.map((r, k) => ({ ...r, underdog: s.planet > 0 && k >= rows.length - data.tour.form.underdogs }));
}

// ---- the simulation ------------------------------------------------------------------------------------
export function tourAction(data: PlannerData, state: TourState, action: TourAction): TourResult {
  const s: TourState = structuredClone(state);
  const T = data.tour;
  const maxParts = data.meta.partSlots.max;
  const maxAbilities = data.meta.abilitySlots;
  let message: string | undefined;
  let rand: Rng = createRng(s.seed);
  const setRand = (): void => {
    rand = createRng(s.seed + s.rolls * 7919);
    s.rolls += 1;
  };
  const log = (text: string, amount = 0): void => {
    s.log.unshift({ planet: s.planet + 1, text, amount });
  };
  const credit = (n: number, why: string): void => {
    s.credits += n;
    s.earned += n;
    log(why, n);
  };
  const spend = (n: number, why: string): void => {
    s.credits -= n;
    s.spent += n;
    log(why, -n);
  };
  const planet = () => {
    const p = T.planets[s.planet];
    if (!p) throw new Error(`no planet ${String(s.planet)}`);
    return p;
  };

  // -- rolls ------------------------------------------------------------------------------------------
  /** Owning a part keeps its own and lower rarities out of offers; a higher rarity can still appear. */
  const offerable = (id: PartId): boolean => {
    const p = partById(data, id);
    return p !== undefined && !s.parts.includes(id) && (ownedSlotOf(data, s, p) < 0 || replaces(data, s, id));
  };
  type Pool = (typeof T.planets)[number]['shop'];
  const rollPart = (pool: Pool, minTier: OfferRarity, exclude: ReadonlySet<PartId>): PartId | null => {
    // the game's chance to offer the next tier of a part family you already own
    if (rand() * 100 < T.familyChance) {
      const next = s.parts
        .map((id) => partById(data, id))
        .filter((a): a is Part => a !== undefined && a.family !== null)
        .map((a) => data.affixes.find((b) => b.family === a.family && a.tier !== null && b.tier === a.tier + 1))
        .filter((b): b is Part => b !== undefined && offerable(b.id) && !exclude.has(b.id) && RANK.indexOf(partTier(b)) >= RANK.indexOf(minTier));
      const pick = pickOne(rand, next);
      if (pick) return pick.id;
    }
    const groups = pool.parts.filter((g) => RANK.indexOf(g.group as OfferRarity) >= RANK.indexOf(minTier) && (T.partGroups[g.group] ?? []).length);
    for (let tries = 0; tries < 20; tries++) {
      const g = pickWeighted(rand, groups, (x) => x.weight) ?? groups.at(-1);
      if (!g) return null;
      const cand = (T.partGroups[g.group] ?? []).filter((id) => offerable(id) && !exclude.has(id));
      const pick = pickOne(rand, cand);
      if (pick) return pick;
    }
    return null;
  };
  const rollParts = (pool: Pool, n: number, minTier: OfferRarity = 'Common'): PartId[] => {
    const out = new Set<PartId>();
    for (let i = 0; i < n; i++) {
      const id = rollPart(pool, minTier, out);
      if (id) out.add(id);
    }
    return [...out];
  };
  /** A won bet guarantees ONE option at its rarity (the game's MinimumRarityForOneItem); the rest roll normally. */
  const rollBetReward = (pool: Pool, n: number, minTier: OfferRarity): PartId[] => {
    const out = new Set<PartId>();
    const first = rollPart(pool, minTier, out);
    if (first) out.add(first);
    for (let i = out.size; i < n; i++) {
      const id = rollPart(pool, 'Common', out);
      if (id) out.add(id);
    }
    const ids = [...out];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const [x, y] = [ids[i], ids[j]];
      if (x !== undefined && y !== undefined) {
        ids[i] = y;
        ids[j] = x;
      }
    }
    return ids;
  };
  // Higher-level abilities upgrade one you own: only new Level 1s, or next steps of a line you own, are offered.
  const ownsLine = (id: AbilityId): boolean =>
    s.abilities.some((o) => {
      for (let a: AbilityId | undefined = o; a; a = abilityParent(data, a)) if (a === id) return true;
      return false;
    });
  const eligible = (id: AbilityId, out: ReadonlySet<AbilityId>): boolean => {
    if (!data.abilities.some((a) => a.id === id) || out.has(id) || ownsLine(id)) return false;
    const parent = abilityParent(data, id);
    return parent ? s.abilities.includes(parent) : true;
  };
  const rollAbilities = (pool: Pool, n: number): AbilityId[] => {
    const out = new Set<AbilityId>();
    for (let i = 0; i < n * 6 && out.size < n; i++) {
      // the pool's Level 1/2/3 weights apply among the groups that still have something you can take
      const groups = pool.abilities.filter((g) => T.abilityGroups[g.group].some((id) => eligible(id, out)));
      const g = pickWeighted(rand, groups, (x) => x.weight);
      if (!g) break;
      const pick = pickOne(rand, T.abilityGroups[g.group].filter((id) => eligible(id, out)));
      if (pick) out.add(pick);
    }
    return [...out];
  };
  const rollUpgrades = (n: number): SlotId[] => {
    const open = data.slots.filter((x) => (s.levels[x.id] ?? 0) < MAX_LEVEL).map((x) => x.id);
    const out: SlotId[] = [];
    while (out.length < n && out.length < open.length) {
      const id = pickOne(rand, open.filter((x) => !out.includes(x)));
      if (id) out.push(id);
    }
    return out;
  };
  const makeRacers = (): Racer[] =>
    Array.from({ length: RACERS }, (_, i) => ({ name: `Racer ${String(i + 1)}`, strength: Math.round(rand() * 100) / 10, finishes: [] }));
  // The first race: every backer offers one random contract from its pool, and you pick one backer.
  // Every later race: the backer you've been with offers that many different contracts from its pool.
  const rollBackers = (): void => {
    const kept = s.backer === null ? undefined : s.backers[s.backer]?.backer;
    const mine = kept ?? (backerLocked(s) ? s.backers[0]?.backer : undefined);
    setRand();
    const pool = mine === undefined ? undefined : T.backers[mine];
    if (mine !== undefined && pool) {
      const left = pool.contracts.map((_, i) => i);
      s.backers = [];
      while (s.backers.length < T.backers.length && left.length) {
        const [contract] = left.splice(Math.floor(rand() * left.length), 1);
        if (contract !== undefined) s.backers.push({ backer: mine, contract });
      }
    } else {
      s.backers = T.backers.map((b, i) => ({ backer: i, contract: Math.floor(rand() * b.contracts.length) }));
    }
    s.backer = null;
    s.contractUnits = 0;
    s.phase = 'backer';
    s.underdogOverride = null;
  };

  // -- gains ------------------------------------------------------------------------------------------
  const applyUpgrade = (slot: SlotId, size: number, prefix = ''): void => {
    const before = s.levels[slot] ?? 0;
    s.levels[slot] = Math.min(MAX_LEVEL, before + size);
    log(`${prefix}${data.slots.find((x) => x.id === slot)?.name ?? slot} ${String(before)} → ${String(s.levels[slot])}`);
  };
  const addPart = (id: PartId): boolean => {
    // a higher rarity of a part you own is an upgrade: it takes the owned part's slot
    if (replaces(data, s, id)) {
      const i = ownedSlotOf(data, s, partById(data, id));
      log(`Upgraded ${partById(data, s.parts[i] ?? '')?.name ?? ''} to ${partById(data, id)?.name ?? ''}`);
      s.parts[i] = id;
      return true;
    }
    if (s.parts.length >= maxParts) {
      message = `All ${String(maxParts)} part slots are full.`;
      return false;
    }
    s.parts.push(id);
    return true;
  };
  const abilityName = (id: AbilityId): string => data.abilities.find((a) => a.id === id)?.name ?? id;
  const addAbility = (id: AbilityId): boolean => {
    const parent = abilityParent(data, id);
    const at = parent ? s.abilities.indexOf(parent) : -1;
    if (parent && at >= 0) {
      s.abilities[at] = id;
      log(`Upgraded ${abilityName(parent)} → ${abilityName(id)}`);
      return true;
    }
    if (s.abilities.length >= maxAbilities) {
      message = `All ${String(maxAbilities)} ability slots are full. Remove one first.`;
      return false;
    }
    s.abilities.push(id);
    return true;
  };

  // -- flow -------------------------------------------------------------------------------------------
  const openShop = (): void => {
    setRand();
    s.phase = 'shop';
    s.shop = { rerolls: 0, partPacks: 0, abilityPacks: 0, sold: [], parts: rollParts(planet().shop, T.shop.parts), pack: null };
  };
  const nextReward = (): void => {
    for (;;) {
      const q = s.queue[0];
      if (!q) {
        s.offer = null;
        openShop();
        return;
      }
      setRand();
      if (q.kind === 'upgrade') s.offer = { kind: 'upgrade', ids: rollUpgrades(s.options) };
      else {
        const bet = T.risk.find((r) => r.id === q.bet);
        s.offer = bet ? { kind: 'part', ids: rollBetReward(planet().reward, s.options + bet.extraOptions, bet.minRarity), skip: bet.skipCredits } : { kind: 'part', ids: [], skip: 0 };
      }
      if (s.offer.ids.length) return;
      s.queue.shift();
    }
  };
  const startRun = (): void => {
    const style = data.styles.find((x) => x.id === s.style);
    Object.assign(s, {
      phase: 'bet',
      planet: 0,
      credits: T.prices.startingCredits,
      earned: 0,
      spent: 0,
      rolls: 0,
      levels: Object.fromEntries(data.slots.map((x) => [x.id, 0])),
      parts: [],
      abilities: [...(style?.abilities ?? [])],
      bet: null,
      finish: null,
      queue: [],
      offer: null,
      shop: null,
      log: [],
      form: { you: 0, field: Array<number>(RACERS).fill(0) },
      underdogOverride: null,
    });
    setRand();
    s.racers = makeRacers();
    log(`Tour starts with ${style?.name ?? s.style} in a ${data.vehicles.find((v) => v.id === s.vehicle)?.name ?? s.vehicle}`);
    rollBackers();
  };
  const finishRace = (): void => {
    const bet = T.risk.find((r) => r.id === s.bet);
    const pos = s.finish;
    if (!bet || pos === null) return;
    setRand();
    const p = planet();
    const place = p.placeCredits[pos - 1] ?? 0;
    credit(p.baseCredits + place, `Finished P${String(pos)}: base ${credits(p.baseCredits)}${place ? ` + placing ${credits(place)}` : ''}`);
    if (s.backer !== null) {
      const o = s.backers[s.backer];
      const c = o ? contractOf(data, o) : undefined;
      const name = o ? (T.backers[o.backer]?.name ?? '') : '';
      const n = Math.max(0, s.contractUnits);
      if (c && n) credit(n * c.perUnit, `${name} contract: ${String(n)} ${unitLabel(c.units)} × ${credits(c.perUnit)}`);
      else log(`${name} contract: nothing achieved`);
    }
    const won = pos <= bet.minFinish;
    const underdog = isUnderdog(data, s);
    s.queue = [{ kind: 'upgrade', title: 'Race completed', note: 'Choose an upgrade', skippable: false }];
    if (won && underdog) {
      credit(p.underdogCredits, 'Underdog Performance');
      s.queue.push({ kind: 'upgrade', title: 'Underdog reward', note: 'Choose an upgrade, or skip', skippable: T.form.reward.skippable });
    }
    // form: your finish and won bet; the other 11 racers fill the remaining positions by strength + swing
    s.form.you += (T.form.positionScore[pos - 1] ?? 0) + (won ? (T.form.betScore[bet.id] ?? 0) : 0);
    const open = Array.from({ length: POSITIONS }, (_, i) => i + 1).filter((n) => n !== pos);
    const order = s.racers.map((r, i) => ({ i, perf: r.strength + gauss(rand) * SWING })).sort((a, b) => b.perf - a.perf);
    order.forEach((o, k) => {
      const at = open[k] ?? POSITIONS;
      s.racers[o.i]?.finishes.push(at);
      s.form.field[o.i] = (s.form.field[o.i] ?? 0) + (T.form.positionScore[at - 1] ?? 0);
    });
    if (won) s.queue.push({ kind: 'betPart', title: `${bet.name} bet won`, note: `Parts, one guaranteed ${bet.minRarity}+, or skip for ${credits(bet.skipCredits)}`, bet: bet.id });
    else log(`${bet.name} bet lost (needed P${String(bet.minFinish)} or better)`);
    s.phase = 'rewards';
    nextReward();
  };

  switch (action.type) {
    case 'setVehicle':
      if (s.phase === 'setup') s.vehicle = action.id;
      break;
    case 'setStyle':
      if (s.phase === 'setup') s.style = action.id;
      break;
    case 'setOptions':
      if (s.phase === 'setup') s.options = Math.max(1, Math.round(action.n));
      break;
    case 'setUpgradeSize':
      if (s.phase === 'setup') s.upgradeSize = Math.max(1, Math.round(action.n));
      break;
    case 'start':
      if (s.phase === 'setup') startRun();
      break;
    case 'pickBacker':
      if (s.phase === 'backer') s.backer = action.index;
      break;
    case 'goTo':
      s.phase = action.phase;
      break;
    case 'pickBet':
      if (s.phase === 'bet') s.bet = action.id;
      break;
    case 'setFinish':
      s.finish = Math.max(1, Math.min(POSITIONS, Math.round(action.position)));
      break;
    case 'setUnits':
      s.contractUnits = Math.max(0, Math.floor(action.n || 0));
      break;
    case 'setUnderdog':
      s.underdogOverride = action.value;
      break;
    case 'finishRace':
      if (s.phase === 'race') finishRace();
      break;
    case 'takeReward': {
      const q = s.queue[0];
      if (s.phase !== 'rewards' || !q || !s.offer) break;
      if (s.offer.kind === 'upgrade') applyUpgrade(action.id as SlotId, s.upgradeSize, `${q.title}: `);
      else {
        if (!addPart(action.id as PartId)) break;
        log(`${q.title}: ${partById(data, action.id)?.name ?? action.id}`);
      }
      s.queue.shift();
      s.offer = null;
      nextReward();
      break;
    }
    case 'skipReward': {
      const q = s.queue.shift();
      if (!q) break;
      if (s.offer?.kind === 'part' && s.offer.skip) credit(s.offer.skip, `Skipped ${q.title.toLowerCase()} reward`);
      else log(`Skipped ${q.title.toLowerCase()}`);
      s.offer = null;
      nextReward();
      break;
    }
    case 'buyPart': {
      const p = partById(data, action.id);
      if (!s.shop || !p || s.shop.sold.includes(action.id)) break;
      const cost = partPrice(data, p);
      if (s.credits < cost) {
        message = `You need ${credits(cost)}.`;
        break;
      }
      if (!addPart(action.id)) break;
      spend(cost, `Bought ${p.name}`);
      s.shop.sold.push(action.id);
      break;
    }
    case 'openPack': {
      if (!s.shop || s.shop.pack) break;
      const cost = packPrice(data, s.shop, action.kind);
      if (s.credits < cost) {
        message = `That pack costs ${credits(cost)}.`;
        break;
      }
      setRand();
      const pack: Pack = action.kind === 'stat' ? { kind: 'stat', ids: rollUpgrades(s.options) } : { kind: 'ability', ids: rollAbilities(planet().shop, s.options) };
      if (!pack.ids.length) {
        message = action.kind === 'stat' ? 'Every stat is already maxed.' : 'Nothing left to roll in that pack.';
        break;
      }
      spend(cost, `Opened ${action.kind === 'stat' ? 'an Upgrade Pack' : 'an Ability Pack'}`);
      if (action.kind === 'stat') s.shop.partPacks += 1;
      else s.shop.abilityPacks += 1;
      s.shop.pack = pack;
      break;
    }
    case 'takePack': {
      const pack = s.shop?.pack;
      if (!s.shop || !pack) break;
      if (pack.kind === 'stat') applyUpgrade(action.id as SlotId, PACK_UPGRADE, 'Upgrade Pack: ');
      else {
        if (!addAbility(action.id as AbilityId)) break;
        log(`Pack: ${abilityName(action.id as AbilityId)}`);
      }
      s.shop.pack = null;
      break;
    }
    case 'reroll': {
      if (!s.shop || s.shop.pack) break;
      const cost = rerollPrice(data, s.shop);
      if (s.credits < cost) {
        message = `A reroll costs ${credits(cost)}.`;
        break;
      }
      spend(cost, 'Rerolled the shop');
      s.shop.rerolls += 1;
      setRand();
      s.shop.parts = rollParts(planet().shop, T.shop.parts);
      s.shop.sold = [];
      break;
    }
    case 'leaveShop':
      if (s.phase !== 'shop' || s.shop?.pack) break;
      s.shop = null;
      if (s.planet >= T.planets.length - 1) {
        s.phase = 'done';
        log('Tour complete');
        break;
      }
      s.planet += 1;
      s.bet = null;
      s.finish = null;
      rollBackers();
      break;
    case 'removeAbility': {
      const [id] = s.abilities.splice(action.index, 1);
      if (id) log(`Removed ${abilityName(id)}`);
      break;
    }
    case 'removePart': {
      const [id] = s.parts.splice(action.index, 1);
      if (id) log(`Removed ${partById(data, id)?.name ?? id}`);
      break;
    }
    case 'newRun':
      return { state: newTour(data, action.seed, s) };
    case 'replay': {
      const again = newTour(data, s.seed, s);
      return tourAction(data, again, { type: 'start' });
    }
  }
  return message === undefined ? { state: s } : { state: s, message };
}
