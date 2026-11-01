// Synergy recommender (ADR 0008): tags parts, abilities and traits by the mechanics they need (their trigger) and
// give (conditions they grant, systems they improve), then scores offers against what a build is built around.
// Ported from the legacy synergy.js; tests/synergy prove the scores match it.
import type { AbilityId, PartId, PlannerData, Requirement, Rule, SlotId, StyleId, Style, TraitId, TunesetId } from '../data/types.ts';

export const MECHANIC_LABEL = {
  ramjet: 'Ramjet',
  redline: 'Redlining',
  surge: 'Surging',
  afterburner: 'Afterburner',
  takedown: 'Takedowns',
  landing: 'Landings',
  airborne: 'Airtime',
  drafting: 'Slipstream',
  overtake: 'Overtakes',
  abilities: 'Abilities & energy',
  cooled: 'Cooled',
  shielded: 'Shielded',
  overclocked: 'Overcharged',
  burning: 'Burning',
  frozen: 'Frozen',
  corroded: 'Corroded',
  concussed: 'Concussed',
  malfunction: 'Malfunctions',
  crash: 'Survival',
  start: 'Race starts',
  position: 'Running in front',
  speed: 'Top speed',
} as const satisfies Record<string, string>;

export type Mechanic = keyof typeof MECHANIC_LABEL;

const CONDITION: Readonly<Record<string, Mechanic>> = {
  Surging: 'surge', Cooled: 'cooled', Shielded: 'shielded', Overclocked: 'overclocked', Malfunction: 'malfunction',
  Burning: 'burning', Concussed: 'concussed', Frozen: 'frozen', Chilled: 'frozen', Corroding: 'corroded', Corroded: 'corroded',
};
const REQUIRE: Readonly<Record<string, Mechanic>> = {
  RamjetState: 'ramjet', TrackedRamjetState: 'ramjet', Takedown: 'takedown', Contact: 'takedown', VehicleLanding: 'landing',
  TrackedVehicleAirborne: 'airborne', AfterburnerState: 'afterburner', TrackedAfterburnerState: 'afterburner', FullAfterburnerUsed: 'afterburner',
  ActivateAbility: 'abilities', EnergyLevel: 'abilities', TrackedEnergyLevel: 'abilities', TrackedVehicleDrafting: 'drafting', Overtake: 'overtake',
  Crashed: 'crash', VehicleResetAfterCrash: 'crash', NotCrashed: 'crash', HealthRemaining: 'crash', VehiclePerfectStart: 'start',
  CountdownEnded: 'start', BecomeRacePosition: 'position', TrackedRacePosition: 'position', CriticalMalfunctionRecovery: 'malfunction', VehicleSpeed: 'speed',
};
const EFFECT: Readonly<Record<string, Mechanic>> = {
  RechargeAfterburner: 'afterburner', RefillBatteryEnergy: 'abilities', AddAbilityCooldown: 'abilities', SetRamjetReady: 'ramjet', CrashesBalance: 'crash',
};
// words in tooltips, for mechanics the rules only imply
const WORDS: readonly (readonly [RegExp, Mechanic])[] = [
  [/Redlin/i, 'redline'], [/Ramjet/i, 'ramjet'], [/Surg/i, 'surge'], [/Afterburner|fuel/i, 'afterburner'], [/Takedown/i, 'takedown'],
  [/Landing/i, 'landing'], [/airborne|airtime/i, 'airborne'], [/Slipstream|draft/i, 'drafting'], [/Overtak/i, 'overtake'], [/Abilit|Energy/i, 'abilities'],
  [/Cooled/i, 'cooled'], [/Shield/i, 'shielded'], [/Overcharg/i, 'overclocked'], [/Burning/i, 'burning'], [/Frozen|Chill/i, 'frozen'],
  [/Corrod/i, 'corroded'], [/Concuss/i, 'concussed'], [/Malfunction/i, 'malfunction'], [/Crash/i, 'crash'], [/Perfect Start/i, 'start'],
  [/first place|in front|lead/i, 'position'], [/top speed|\bSpeed\b/i, 'speed'],
];

function cfgMechanics(cfg: string, field: string): Mechanic[] {
  const out: Mechanic[] = [];
  if (cfg.includes('Ramjet')) out.push('ramjet');
  if (/ExplodeLatch|ExplodeDrain|Redline/.test(field)) out.push('redline');
  if (cfg.includes('Afterburner')) out.push('afterburner');
  if (cfg.includes('Drafting')) out.push('drafting');
  if (cfg.includes('Landing')) out.push('landing');
  if (cfg.includes('AbilityTune')) out.push('abilities');
  if (cfg.includes('Health') || field.includes('CrashAllowance')) out.push('crash');
  if (cfg.includes('Ignition')) out.push('start');
  if (cfg.includes('CriticalMalfunction')) out.push('malfunction');
  if (field.startsWith("Surge")) out.push('surge');
  if ((cfg === 'VehicleGameplayConfig' && field === 'Power') || /HighSpeedStep|TopSpeedIncrease/.test(field)) out.push('speed');
  if (cfg.includes('Condition')) for (const [w, m] of Object.entries(CONDITION)) if (field.includes(w)) out.push(m);
  return out;
}

const condOf = (props: Requirement['props']): Mechanic[] =>
  Object.values(props)
    .map((v) => (typeof v === 'string' ? /Vehicle\.Condition\.(\w+)/.exec(v)?.[1] : undefined))
    .map((c) => (c === undefined ? undefined : CONDITION[c]))
    .filter((m): m is Mechanic => m !== undefined);

export interface Tags {
  /** What sets it off. */
  needs: ReadonlySet<Mechanic>;
  /** What it grants or improves. */
  gives: ReadonlySet<Mechanic>;
  /** Everything it has to do with, including tooltip words. */
  touches: ReadonlySet<Mechanic>;
}

interface Taggable {
  name: string;
  desc: string;
  rules?: readonly Rule[];
  tunesets?: readonly TunesetId[];
  /** Only abilities have a level; their names are the mechanic itself, so they count as text. */
  level?: string;
}

function tag(item: Taggable, data: PlannerData): Tags {
  const needs = new Set<Mechanic>();
  const gives = new Set<Mechanic>();
  const touches = new Set<Mechanic>();
  const addTs = (name: TunesetId): void => {
    const ts = data.tunesets[name];
    if (!ts) return;
    const ops = ts.stacking ? ts.core : ts.ops;
    for (const o of ops) for (const m of cfgMechanics(o.cfg, o.field)) gives.add(m);
  };
  for (const r of item.rules ?? []) {
    for (const q of r.requires) {
      const m = REQUIRE[q.type];
      if (m) needs.add(m);
      if (q.type.includes('Ramjet') && /Critical|Redline|Overheat|Explode/i.test(JSON.stringify(q.props))) needs.add('redline');
      for (const c of condOf(q.props)) needs.add(c);
    }
    for (const e of r.effects) {
      const m = EFFECT[e.type];
      if (m) gives.add(m);
      for (const c of condOf(e.props)) gives.add(c);
      e.tunesets.forEach(addTs);
    }
    r.tunesets.forEach(addTs);
  }
  (item.tunesets ?? []).forEach(addTs);
  // Words only from the tooltip: part and trait names are flavour ("Extra Fuel" grants Surge, not fuel).
  // Ability names are the mechanic itself (Surge, Shield), so those count.
  const text = item.level ? `${item.name} ${item.desc}` : item.desc;
  for (const [rx, m] of WORDS) if (rx.test(text)) touches.add(m);
  for (const m of needs) touches.add(m);
  for (const m of gives) touches.add(m);
  return { needs, gives, touches };
}

export type OfferKind = 'part' | 'ability' | 'trait';

/** The parts of a build the recommender looks at. */
export interface SynergyBuild {
  style: StyleId;
  abilities: readonly AbilityId[];
  parts: readonly PartId[];
  levels: Readonly<Partial<Record<SlotId, number>>>;
}

type Weights = Partial<Record<Mechanic, number>>;

export interface Profile {
  /** How much the build touches each mechanic. */
  w: Weights;
  needW: Weights;
  giveW: Weights;
  style: Style | undefined;
}

export interface Score {
  score: number;
  /** One line explaining the fit. */
  reason: string;
  pay: number;
  trig: number;
}

export interface FocusShare {
  id: Mechanic;
  label: string;
  share: number;
}

const TIER: Readonly<Record<string, number>> = { Common: 0, Rare: 1, Epic: 2, Legendary: 3, Faulty: -3 };
/** Below this an offer isn't a real fit, so nothing is called "Best fit". */
export const MIN_FIT = 5;

const get = (w: Weights, m: Mechanic): number => w[m] ?? 0;
const bump = (w: Weights, m: Mechanic, by: number): void => {
  w[m] = get(w, m) + by;
};

export function createSynergy(data: PlannerData) {
  const empty: Tags = { needs: new Set(), gives: new Set(), touches: new Set() };
  const cache = new Map<string, Tags>();

  function tagsOf(kind: OfferKind, id: string): Tags {
    const key = `${kind}:${id}`;
    let t = cache.get(key);
    if (!t) {
      const item: Taggable | undefined =
        kind === 'part' ? data.affixes.find((a) => a.id === id) : kind === 'ability' ? data.abilities.find((a) => a.id === id) : data.traits[id as TraitId];
      t = item ? tag(item, data) : empty;
      cache.set(key, t);
    }
    return t;
  }

  /** A build's focus: what its style traits, starting abilities, current abilities and parts revolve around. */
  function profile(build: SynergyBuild): Profile {
    const style = data.styles.find((s) => s.id === build.style);
    const w: Weights = {};
    const needW: Weights = {};
    const giveW: Weights = {};
    const add = (t: Tags, weight: number): void => {
      t.touches.forEach((m) => { bump(w, m, weight); });
      t.needs.forEach((m) => { bump(needW, m, weight); });
      t.gives.forEach((m) => { bump(giveW, m, weight); });
    };
    if (style) {
      style.traits.forEach((t) => { add(tagsOf('trait', t), 3); });
      style.abilities.forEach((a) => { add(tagsOf('ability', a), 2); });
    }
    build.abilities.forEach((a) => { add(tagsOf('ability', a), 1.5); });
    build.parts.forEach((p) => { add(tagsOf('part', p), 1); });
    return { w, needW, giveW, style };
  }

  /**
   * Scores one offer as (how much the build wants what it GIVES) × (how often the build sets off what it NEEDS).
   * A part whose trigger fits but whose payoff the build doesn't care about (a shield for a speed build) scores low;
   * so does a great payoff behind a trigger the build rarely hits.
   */
  function score(kind: OfferKind, id: string, build: SynergyBuild, prof: Profile = profile(build)): Score {
    const t = tagsOf(kind, id);
    const does = (m: Mechanic): number => get(prof.giveW, m) + get(prof.w, m) * 0.5; // how often the build sets this off
    const wants = (m: Mechanic): number => get(prof.w, m) + get(prof.needW, m) * 1.5; // how much the build wants this
    // payoff: what the rules grant, plus what the tooltip says it boosts (e.g. "increase Speed"), minus its own trigger
    const payoffs = [...new Set([...t.gives, ...[...t.touches].filter((m) => !t.needs.has(m))])];
    let pay = 0;
    let topPay: Mechanic | null = null;
    for (const m of payoffs) {
      const v = wants(m);
      pay += v;
      if (v && (!topPay || v > wants(topPay))) topPay = m;
    }
    let trig = 1;
    let topNeed: Mechanic | null = null;
    if (t.needs.size) {
      topNeed = [...t.needs].sort((a, b) => does(b) - does(a))[0] ?? null;
      trig = topNeed === null ? 1 : Math.min(1.25, 0.2 + does(topNeed) / 6);
    }
    let s = trig * pay;
    let reason: string;
    if (!topPay) reason = 'Adds little to this build';
    else if (topNeed && does(topNeed) > 0) reason = topNeed === topPay ? `Strengthens your ${MECHANIC_LABEL[topPay]} loop` : `Turns your ${MECHANIC_LABEL[topNeed]} into ${MECHANIC_LABEL[topPay]}`;
    else if (topNeed) reason = `${MECHANIC_LABEL[topPay]} fits, but it needs ${MECHANIC_LABEL[topNeed]}, which your build rarely does`;
    else reason = get(prof.needW, topPay) ? `Boosts ${MECHANIC_LABEL[topPay]}, which your build relies on` : `Always-on ${MECHANIC_LABEL[topPay]}, central to your build`;
    if (kind === 'part') {
      const a = data.affixes.find((x) => x.id === id);
      if (a) {
        s += (TIER[a.rarity] ?? 0) * 0.4;
        if (!t.needs.size) s += 0.5; // always-on is reliable
        const owned = build.parts.map((p) => data.affixes.find((x) => x.id === p)).find((o) => o && o.family !== null && o.family === a.family);
        if (owned && a.tier !== null && owned.tier !== null && a.tier > owned.tier && pay > 0) {
          s += 2;
          reason = `Higher tier of your ${owned.name}`;
        }
      }
    }
    return { score: s, reason, pay, trig };
  }

  /** Upgrades follow the game's own per-style upgrade priority, spread across slots as levels rise. */
  function scoreUpgrade(slot: SlotId, build: SynergyBuild): { score: number; reason: string } {
    const style = data.styles.find((s) => s.id === build.style);
    const pr = style?.priority ?? {};
    const lv = build.levels[slot] ?? 0;
    const p = pr[slot];
    return {
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- a priority of 0 also falls back to 1, as in the legacy scorer
      score: (p || 1) / (1 + lv),
      reason: p && style ? `${style.name} prioritises ${slot === 'AbilityUsage' ? 'Battery' : slot}` : 'Balanced upgrade',
    };
  }

  /** The build's top mechanics and their share of its focus. */
  function focus(build: SynergyBuild, n = 4): FocusShare[] {
    const { w } = profile(build);
    const entries = Object.entries(w) as [Mechanic, number][];
    const tot = entries.reduce((a, [, v]) => a + v, 0) || 1;
    return entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([m, v]) => ({ id: m, label: MECHANIC_LABEL[m], share: v / tot }));
  }

  return { tagsOf, profile, score, scoreUpgrade, focus };
}

export type Synergy = ReturnType<typeof createSynergy>;
