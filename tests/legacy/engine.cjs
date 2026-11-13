// REFERENCE ONLY: the legacy planner engine, kept verbatim so tests can prove the TypeScript port matches it.
// Delete together with the legacy site (see CLAUDE.md, ADR 0008).
// SWGR build planner engine: turns a build into the tune operations the game would apply,
// then applies them to the vehicle's base configs.
//
// Operation names come straight from the game (ETuneOperations). Combination order is an assumption:
// flat adds and "multiple" adds (fractions of the base) are summed, then multipliers are applied:
//   value = (base + Σadd + base·Σmultiple) · Πmultiply
(function (root) {
  const OP_RX = /^(FloatCurve|VectorCurve([XYZ])?|FloatArray|Vector2D|Vector|Float|Int|Bool)(Single|All)?(AddMultiple|SubtractMultiple|Add|Subtract|Multiply|SetTrue|SetFalse)$/;

  function parseOp(name) {
    const m = OP_RX.exec(name);
    if (!m) return null;
    return { type: m[1], comp: m[2] || null, scope: m[3] || null, action: m[4] };
  }

  // contribution kinds: add, mult (fraction of base), mul (multiplier), set
  function kindOf(action, amount, steps) {
    switch (action) {
      case 'Add': return ['add', amount * steps];
      case 'Subtract': return ['add', -amount * steps];
      case 'AddMultiple': return ['mult', amount * steps];
      case 'SubtractMultiple': return ['mult', -amount * steps];
      case 'Multiply': return ['mul', Math.pow(amount, steps)];
      case 'SetTrue': return ['set', true];
      case 'SetFalse': return ['set', false];
    }
    return null;
  }

  // Expands one operation into per-cell contributions. Cells address scalars inside a value:
  // '' for a number, '0'..'2' for vector components, 'k1.t' / 'k1.v' for curve keys, 'c2.k1.v' for vector curves.
  function contributions(op, base, steps) {
    const p = parseOp(op.op);
    if (!p) return [];
    const out = [];
    const push = (cell, amount) => { const k = kindOf(p.action, amount, steps); if (k && (k[0] === 'set' || amount !== 0 || p.action === 'Multiply')) out.push([cell, k[0], k[1]]); };
    if (p.type === 'Float' || p.type === 'Int') push('', p.type === 'Int' ? op.i : op.f);
    else if (p.type === 'Bool') push('', 1);
    else if (p.type === 'Vector2D') { push('0', op.v2[0]); push('1', op.v2[1]); }
    else if (p.type === 'Vector') { push('0', op.v3[0]); push('1', op.v3[1]); push('2', op.v3[2]); }
    else if (p.type === 'FloatArray') push(String(op.i), op.f);
    else if (p.type === 'FloatCurve' || p.type === 'VectorCurve') {
      // X adjusts a key's input (time), Y its output (value).
      const comps = p.type === 'FloatCurve' ? [null] : (p.comp ? ['XYZ'.indexOf(p.comp)] : [0, 1, 2]);
      for (const c of comps) {
        const keys = c === null ? (base && base.curve) : (base && base.vcurve && base.vcurve[c]);
        const n = keys ? keys.length : (p.scope === 'Single' ? op.i + 1 : 0);
        const idx = p.scope === 'Single' ? [op.i] : [...Array(n).keys()];
        const pre = c === null ? '' : `c${c}.`;
        for (const k of idx) {
          if (p.action === 'Multiply') { if (op.v2[0] !== 1) push(`${pre}k${k}.t`, op.v2[0]); if (op.v2[1] !== 1) push(`${pre}k${k}.v`, op.v2[1]); }
          else { if (op.v2[0]) push(`${pre}k${k}.t`, op.v2[0]); if (op.v2[1]) push(`${pre}k${k}.v`, op.v2[1]); }
        }
      }
    }
    return out;
  }

  function cellBase(base, cell) {
    if (base === undefined || base === null) return undefined;
    if (cell === '') return typeof base === 'boolean' ? base : (typeof base === 'number' ? base : undefined);
    if (Array.isArray(base)) return base[+cell];
    const m = /^(?:c(\d)\.)?k(\d+)\.([tv])$/.exec(cell);
    if (m) {
      const keys = m[1] !== undefined ? base.vcurve && base.vcurve[+m[1]] : base.curve;
      const key = keys && keys[+m[2]];
      return key ? key[m[3] === 't' ? 0 : 1] : undefined;
    }
    return undefined;
  }

  function combine(b, parts) {
    let add = 0, mult = 0, mul = 1, set;
    for (const [kind, amt] of parts) {
      if (kind === 'add') add += amt; else if (kind === 'mult') mult += amt; else if (kind === 'mul') mul *= amt; else set = amt;
    }
    if (set !== undefined) return set;
    if (b === undefined) return { add, mult, mul };            // base unknown: return the modifier itself
    return (b + add + b * mult) * mul;
  }

  // ---- build -> sourced operations -------------------------------------------------------------
  // build = { vehicle, style, levels: {slotId: n}, parts: [affixId], abilities: [abilityId],
  //           active: {conditionKey: true | timesTriggered} }
  function collect(data, build) {
    const ops = [];
    const isPlane = build.vehicle === 'Plane';
    // How many times a situational effect is counted: true = once, a number = that many triggers.
    const times = (key) => { const a = build.active && build.active[key]; return a === true ? 1 : Math.max(0, Math.floor(+a || 0)); };
    const addTuneset = (name, steps, source, cond, repeat = 1) => {
      const ts = data.tunesets[name];
      if (!ts) return;
      const list = ts.stacking ? (isPlane ? ts.plane : ts.core) : ts.ops;
      const n = ts.stacking ? steps : 1;
      if (!n) return;
      for (let k = 0; k < repeat; k++) for (const op of list) {
        // Shared TuneSets carry Car/Bike/Skimmer/Plane-specific configs; keep only the chosen vehicle's.
        const cls = /^(Car|Bike|Skimmer|Plane)(?=[A-Z])/.exec(op.cfg);
        if (cls && cls[1] !== build.vehicle) continue;
        ops.push({ op, steps: n, source, cond });
      }
    };
    const conditionals = [];
    const addRules = (owner, ownerLabel, rules, desc) => {
      rules.forEach((r, ri) => {
        const always = !r.requires.length;
        const key = `${owner}#${ri}`;
        // A requirement that resets after firing ("every takedown") re-arms, so its effect stacks per trigger.
        const repeatable = !r.once && (r.repeat || r.requires.some((q) => q.props && q.props.ResetOnCompletion));
        if (r.tunesets.length) {
          if (always) r.tunesets.forEach((t) => addTuneset(t, 1, ownerLabel, null));
          else {
            conditionals.push({ key, owner: ownerLabel, desc, requires: r.requires, kind: 'rule', repeatable });
            r.tunesets.forEach((t) => addTuneset(t, 1, ownerLabel, key, times(key)));
          }
        }
        r.effects.forEach((e, ei) => {
          if (!e.tunesets.length) return;
          const ek = `${key}.e${ei}`;
          conditionals.push({ key: ek, owner: ownerLabel, desc, requires: r.requires, effect: e, kind: 'effect', repeatable });
          e.tunesets.forEach((t) => addTuneset(t, 1, ownerLabel, ek, times(ek)));
        });
      });
    };

    let power = 0;
    for (const slot of data.slots) {
      const lv = build.levels && build.levels[slot.id] || 0;
      const L = slot.levels[lv];
      if (!L || !lv) continue;
      power += L.power;
      addTuneset(L.tuneset, L.stat, `${slot.name} ${lv}`, null);
    }
    if (power) addTuneset(data.powerTuneset, power, `Power rating ${power}`, null);

    const style = data.styles.find((s) => s.id === build.style);
    if (style) for (const t of style.traits) { const tr = data.traits[t]; if (tr) addRules(t, `${tr.name} (trait)`, tr.rules, tr.desc); }
    for (const id of build.parts || []) { const a = data.affixes.find((x) => x.id === id); if (a) addRules(id, a.name, a.rules, a.desc); }
    for (const id of build.favours || []) { const f = (data.favours || []).find((x) => x.id === id); if (f) addRules(id, `${f.name} ${f.rank} (favour)`, f.rules, f.desc); }
    for (const id of build.abilities || []) {
      const ab = data.abilities.find((x) => x.id === id);
      if (!ab) continue;
      ab.tunesets.forEach((t, ti) => {
        const key = `${id}#t${ti}`;
        conditionals.push({ key, owner: ab.name, desc: ab.desc, ability: true, kind: 'ability', repeatable: true });
        addTuneset(t, 1, ab.name, key, times(key));
      });
    }
    // "Increase Speed" effects raise the Power stat, and every Power point is a step of the power tuneset (top speed),
    // so situational Power gains feed it too. Power is not capped: effects like Repulsormod push it past 60 mid-race.
    let powerBonus = 0;
    for (const { op, cond } of ops) if (cond && op.cfg === 'VehicleGameplayConfig' && op.field === 'Power' && op.op === 'IntAdd') powerBonus += op.i;
    powerBonus = Math.max(0, powerBonus);
    if (powerBonus) addTuneset(data.powerTuneset, powerBonus, `Speed gains +${powerBonus} power`, 'power-bonus');
    return { ops, conditionals, power, powerBonus };
  }

  // ---- apply -------------------------------------------------------------------------------------
  function evaluate(data, build) {
    const veh = data.vehicles.find((v) => v.id === build.vehicle);
    const { ops, conditionals, power, powerBonus } = collect(data, build);
    const fields = new Map();   // "cfg.field" -> { cfg, field, base, cells: Map(cell -> [kind, amt][]), sources:Set }
    for (const { op, steps, source, cond } of ops) {
      const key = `${op.cfg}.${op.field}`;
      if (!fields.has(key)) {
        const base = (veh.configs[op.cfg] || {})[op.field] ?? (data.globals[op.cfg] || {})[op.field];
        fields.set(key, { cfg: op.cfg, field: op.field, base, cells: new Map(), sources: new Map() });
      }
      const f = fields.get(key);
      for (const [cell, kind, amt] of contributions(op, f.base, steps)) {
        if (!f.cells.has(cell)) f.cells.set(cell, []);
        f.cells.get(cell).push([kind, amt]);
      }
      f.sources.set(source, cond ? 'conditional' : 'always');
    }
    const rows = [];
    for (const f of fields.values()) {
      const cells = [];
      for (const [cell, parts] of f.cells) {
        const b = cellBase(f.base, cell);
        cells.push({ cell, base: b, value: combine(b, parts) });
      }
      rows.push({ cfg: f.cfg, field: f.field, base: f.base, cells, known: cells.every((c) => typeof c.value !== 'object'),
                  sources: [...f.sources].map(([s, k]) => ({ source: s, kind: k })) });
    }
    rows.sort((a, b) => a.cfg.localeCompare(b.cfg) || a.field.localeCompare(b.field));
    return { rows, conditionals, power, powerBonus };
  }

  const api = { parseOp, contributions, combine, collect, evaluate };
  if (typeof module !== 'undefined') module.exports = api; else root.SWGREngine = api;
})(this);
