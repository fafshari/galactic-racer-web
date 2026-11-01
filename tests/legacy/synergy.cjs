// REFERENCE ONLY: the legacy synergy scorer, kept verbatim so tests can prove the TypeScript port matches it.
// Delete together with the legacy site (see CLAUDE.md, ADR 0008).
// SWGR synergy recommender: tags parts, abilities and traits by the mechanics they need (their trigger) and
// give (conditions they grant, systems they improve), then scores offers against what a build is built around.
(function (root) {
  const LABEL = {
    ramjet: 'Ramjet', redline: 'Redlining', surge: 'Surging', afterburner: 'Afterburner', takedown: 'Takedowns',
    landing: 'Landings', airborne: 'Airtime', drafting: 'Slipstream', overtake: 'Overtakes', abilities: 'Abilities & energy',
    cooled: 'Cooled', shielded: 'Shielded', overclocked: 'Overcharged', burning: 'Burning', frozen: 'Frozen',
    corroded: 'Corroded', concussed: 'Concussed', malfunction: 'Malfunctions', crash: 'Survival', start: 'Race starts',
    position: 'Running in front', speed: 'Top speed',
  };
  const CONDITION = { Surging: 'surge', Cooled: 'cooled', Shielded: 'shielded', Overclocked: 'overclocked', Malfunction: 'malfunction',
    Burning: 'burning', Concussed: 'concussed', Frozen: 'frozen', Chilled: 'frozen', Corroding: 'corroded', Corroded: 'corroded' };
  const REQUIRE = {
    RamjetState: 'ramjet', TrackedRamjetState: 'ramjet', Takedown: 'takedown', Contact: 'takedown', VehicleLanding: 'landing',
    TrackedVehicleAirborne: 'airborne', AfterburnerState: 'afterburner', TrackedAfterburnerState: 'afterburner', FullAfterburnerUsed: 'afterburner',
    ActivateAbility: 'abilities', EnergyLevel: 'abilities', TrackedEnergyLevel: 'abilities', TrackedVehicleDrafting: 'drafting', Overtake: 'overtake',
    Crashed: 'crash', VehicleResetAfterCrash: 'crash', NotCrashed: 'crash', HealthRemaining: 'crash', VehiclePerfectStart: 'start',
    CountdownEnded: 'start', BecomeRacePosition: 'position', TrackedRacePosition: 'position', CriticalMalfunctionRecovery: 'malfunction', VehicleSpeed: 'speed',
  };
  const EFFECT = { RechargeAfterburner: 'afterburner', RefillBatteryEnergy: 'abilities', AddAbilityCooldown: 'abilities', SetRamjetReady: 'ramjet', CrashesBalance: 'crash' };
  // words in tooltips, for mechanics the rules only imply
  const WORDS = [[/Redlin/i, 'redline'], [/Ramjet/i, 'ramjet'], [/Surg/i, 'surge'], [/Afterburner|fuel/i, 'afterburner'], [/Takedown/i, 'takedown'],
    [/Landing/i, 'landing'], [/airborne|airtime/i, 'airborne'], [/Slipstream|draft/i, 'drafting'], [/Overtak/i, 'overtake'], [/Abilit|Energy/i, 'abilities'],
    [/Cooled/i, 'cooled'], [/Shield/i, 'shielded'], [/Overcharg/i, 'overclocked'], [/Burning/i, 'burning'], [/Frozen|Chill/i, 'frozen'],
    [/Corrod/i, 'corroded'], [/Concuss/i, 'concussed'], [/Malfunction/i, 'malfunction'], [/Crash/i, 'crash'], [/Perfect Start/i, 'start'],
    [/first place|in front|lead/i, 'position'], [/top speed|\bSpeed\b/i, 'speed']];

  function cfgMechanics(cfg, field) {
    const out = [];
    if (/Ramjet/.test(cfg)) out.push('ramjet');
    if (/ExplodeLatch|ExplodeDrain|Redline/.test(field)) out.push('redline');
    if (/Afterburner/.test(cfg)) out.push('afterburner');
    if (/Drafting/.test(cfg)) out.push('drafting');
    if (/Landing/.test(cfg)) out.push('landing');
    if (/AbilityTune/.test(cfg)) out.push('abilities');
    if (/Health/.test(cfg) || /CrashAllowance/.test(field)) out.push('crash');
    if (/Ignition/.test(cfg)) out.push('start');
    if (/CriticalMalfunction/.test(cfg)) out.push('malfunction');
    if (/^Surge/.test(field)) out.push('surge');
    if (cfg === 'VehicleGameplayConfig' && field === 'Power' || /HighSpeedStep|TopSpeedIncrease/.test(field)) out.push('speed');
    if (/Condition/.test(cfg)) for (const [w, m] of Object.entries(CONDITION)) if (field.includes(w)) out.push(m);
    return out;
  }
  const condOf = (props) => Object.values(props || {}).map((v) => (typeof v === 'string' ? (v.match(/Vehicle\.Condition\.(\w+)/) || [])[1] : null)).filter(Boolean).map((c) => CONDITION[c]).filter(Boolean);

  function tag(item, data) {
    const needs = new Set(), gives = new Set(), touches = new Set();
    const addTs = (name) => { const ts = data.tunesets[name]; if (!ts) return; for (const o of [...(ts.ops || []), ...(ts.core || [])]) cfgMechanics(o.cfg, o.field).forEach((m) => gives.add(m)); };
    for (const r of item.rules || []) {
      for (const q of r.requires) {
        if (REQUIRE[q.type]) needs.add(REQUIRE[q.type]);
        if (/Ramjet/.test(q.type) && /Critical|Redline|Overheat|Explode/i.test(JSON.stringify(q.props))) needs.add('redline');
        condOf(q.props).forEach((m) => needs.add(m));
      }
      for (const e of r.effects) {
        if (EFFECT[e.type]) gives.add(EFFECT[e.type]);
        condOf(e.props).forEach((m) => gives.add(m));
        (e.tunesets || []).forEach(addTs);
      }
      r.tunesets.forEach(addTs);
    }
    (item.tunesets || []).forEach(addTs);
    // Words only from the tooltip: part and trait names are flavour ("Extra Fuel" grants Surge, not fuel).
    // Ability names are the mechanic itself (Surge, Shield), so those count.
    const text = item.level ? `${item.name} ${item.desc}` : item.desc;
    for (const [rx, m] of WORDS) if (rx.test(text || '')) touches.add(m);
    needs.forEach((m) => touches.add(m)); gives.forEach((m) => touches.add(m));
    return { needs, gives, touches };
  }

  function make(data) {
    const cache = new Map();
    const tagsOf = (kind, id) => {
      const key = kind + ':' + id;
      if (!cache.has(key)) {
        const item = kind === 'part' ? data.affixes.find((a) => a.id === id) : kind === 'ability' ? data.abilities.find((a) => a.id === id) : data.traits[id];
        cache.set(key, item ? tag(item, data) : { needs: new Set(), gives: new Set(), touches: new Set() });
      }
      return cache.get(key);
    };

    // A build's focus: what its style traits, starting abilities, current abilities and parts revolve around.
    function profile(build) {
      const style = data.styles.find((s) => s.id === build.style);
      const w = {}, needW = {}, giveW = {};
      const add = (t, weight) => {
        t.touches.forEach((m) => { w[m] = (w[m] || 0) + weight; });
        t.needs.forEach((m) => { needW[m] = (needW[m] || 0) + weight; });
        t.gives.forEach((m) => { giveW[m] = (giveW[m] || 0) + weight; });
      };
      if (style) {
        style.traits.forEach((t) => add(tagsOf('trait', t), 3));
        style.abilities.forEach((a) => add(tagsOf('ability', a), 2));
      }
      (build.abilities || []).forEach((a) => add(tagsOf('ability', a), 1.5));
      (build.parts || []).forEach((p) => add(tagsOf('part', p), 1));
      return { w, needW, giveW, style };
    }

    const TIER = { Common: 0, Rare: 1, Epic: 2, Legendary: 3, Faulty: -3 };
    // Score one offer as (how much the build wants what it GIVES) × (how often the build sets off what it NEEDS).
    // A part whose trigger fits but whose payoff the build doesn't care about (e.g. a shield for a speed build)
    // scores low; so does a great payoff behind a trigger the build rarely hits.
    function score(kind, id, build, prof = profile(build)) {
      const t = tagsOf(kind, id);
      const does = (m) => (prof.giveW[m] || 0) + (prof.w[m] || 0) * 0.5;      // how often the build sets this off
      const wants = (m) => (prof.w[m] || 0) + (prof.needW[m] || 0) * 1.5;    // how much the build wants this
      // payoff: what the rules grant, plus what the tooltip says it boosts (e.g. "increase Speed"), minus its own trigger
      const payoffs = [...new Set([...t.gives, ...[...t.touches].filter((m) => !t.needs.has(m))])];
      let pay = 0, topPay = null;
      for (const m of payoffs) { const v = wants(m); pay += v; if (v && (!topPay || v > wants(topPay))) topPay = m; }
      let trig = 1, topNeed = null;
      if (t.needs.size) {
        topNeed = [...t.needs].sort((a, b) => does(b) - does(a))[0];
        trig = Math.min(1.25, 0.2 + does(topNeed) / 6);
      }
      let s = trig * pay, reason;
      if (!topPay) reason = 'Adds little to this build';
      else if (topNeed && does(topNeed) > 0) reason = topNeed === topPay ? `Strengthens your ${LABEL[topPay]} loop` : `Turns your ${LABEL[topNeed]} into ${LABEL[topPay]}`;
      else if (topNeed) reason = `${LABEL[topPay]} fits, but it needs ${LABEL[topNeed]}, which your build rarely does`;
      else reason = (prof.needW[topPay] ? `Boosts ${LABEL[topPay]}, which your build relies on` : `Always-on ${LABEL[topPay]}, central to your build`);
      if (kind === 'part') {
        const a = data.affixes.find((x) => x.id === id);
        s += (TIER[a.rarity] || 0) * 0.4;
        if (!t.needs.size) s += 0.5;  // always-on is reliable
        const owned = (build.parts || []).map((p) => data.affixes.find((x) => x.id === p)).find((o) => o && o.family !== null && o.family === a.family);
        if (owned && a.tier > owned.tier && pay > 0) { s += 2; reason = `Higher tier of your ${owned.name}`; }
      }
      return { score: s, reason, pay, trig };
    }
    // Below this an offer isn't a real fit, so nothing is called "Best fit".
    const MIN_FIT = 5;

    // Upgrades follow the game's own per-style upgrade priority, spread across slots as levels rise.
    function scoreUpgrade(slot, build) {
      const style = data.styles.find((s) => s.id === build.style);
      const pr = (style && style.priority) || {};
      const lv = (build.levels || {})[slot] || 0;
      return { score: (pr[slot] || 1) / (1 + lv), reason: pr[slot] ? `${style.name} prioritises ${slot === 'AbilityUsage' ? 'Battery' : slot}` : 'Balanced upgrade' };
    }

    function focus(build, n = 4) {
      const { w } = profile(build);
      const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1;
      return Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, n).map(([m, v]) => ({ id: m, label: LABEL[m], share: v / tot }));
    }
    return { tagsOf, profile, score, scoreUpgrade, focus, LABEL, MIN_FIT };
  }

  const api = { make };
  if (typeof module !== 'undefined') module.exports = api; else root.SWGRSynergy = api;
})(this);
