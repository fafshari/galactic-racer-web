// Fills the game's text placeholders that the exported data leaves in descriptions. The game formats these at
// runtime from the same rules the planner already reads, so the numbers come from there, not from a hand-kept list.
import type { PlannerData, Rule, Trait, TraitId, TuneOp } from './types.ts';

/** The percentage an op stands for in the game's text: ×2 is "100%", +0.25 of the base is "25%". */
function opPercent(op: TuneOp): number | null {
  switch (op.op) {
    case 'FloatMultiply': return (op.f - 1) * 100;
    case 'FloatAddMultiple': return op.f * 100;
    case 'VectorAddMultiple': return op.v3[0] * 100;
    default: return null;
  }
}

/**
 * The {perc} of a trait: its first tuneset's percentage (how much more powerful, how much longer), else a refill
 * effect's share of the tank. Null when the rules carry no number.
 */
export function rulesPercent(data: PlannerData, rules: readonly Rule[]): number | null {
  const tunesets = rules.flatMap((r) => [...r.tunesets, ...r.effects.flatMap((e) => e.tunesets)]);
  for (const id of tunesets) {
    const ts = data.tunesets[id];
    const ops = ts ? (ts.stacking ? ts.core : ts.ops) : [];
    for (const op of ops) {
      const p = opPercent(op);
      if (p) return p;
    }
  }
  for (const e of rules.flatMap((r) => r.effects)) {
    const v = e.props.EnergyValue;
    if (typeof v === 'number') return v * 100;
  }
  return null;
}

const percentText = (p: number): string => `${String(Math.round(p * 10) / 10)}%`;

/** The data with every trait's {perc} filled in from its rules. Other placeholders are left as they are. */
export function resolveText(data: PlannerData): PlannerData {
  const traits: Record<TraitId, Trait> = {};
  for (const t of Object.values(data.traits)) {
    const p = t.desc.includes('{perc}') ? rulesPercent(data, t.rules) : null;
    traits[t.id] = p === null ? t : { ...t, desc: t.desc.replaceAll('{perc}', percentText(p)) };
  }
  return { ...data, traits };
}
