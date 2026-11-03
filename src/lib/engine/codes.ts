// Build codes: the compact, URL-safe form of a build stored in the link's hash (ADR 0010).
//
//   gr2-{m|c}{vehicle}{style: 2 base-36}{6 levels: 1 base-36 each}.{parts}.{abilities}.{favours}
//
// Every list is 2-character base-36 positions taken from src/data/build-order.json, never from the data arrays,
// so codes keep meaning the same thing after game patches. Empty trailing sections are dropped because chat apps
// strip trailing dots from links. The style `zz` means no racer style; no style can take that position (ORDER_CAPACITY).
import { buildOrder as defaultOrder, planner } from '../data/index.ts';
import type { BuildOrder, OrderKind } from '../data/order.ts';
import type { PlannerData } from '../data/types.ts';
import { MAX_LEVEL, fitAbilities, freshBuild, type Build } from './build.ts';

const CODE_RX = /^gr2-([mc])(\d)([0-9a-z]{2})([0-9a-z]{6})(?:\.([0-9a-z]*))?(?:\.([0-9a-z]*))?(?:\.([0-9a-z]*))?\.*$/;

export class BuildCodeError extends Error {
  override name = 'BuildCodeError';
}

const b36 = (n: number, width: number): string => n.toString(36).padStart(width, '0');

/** The style digits of a build with no racer style. */
export const NO_STYLE = 'zz';

function positionsOf(order: BuildOrder, kind: OrderKind): Map<string, number> {
  return new Map(order[kind].map((id, i) => [id, i]));
}

/** Encodes a build. Throws if something in it has no build-code position (run `npm run import-data`). */
export function encodeBuild(build: Build, order: BuildOrder = defaultOrder): string {
  const pos = (kind: OrderKind, id: string, width: number): string => {
    const i = positionsOf(order, kind).get(id);
    if (i === undefined) throw new BuildCodeError(`${kind}: "${id}" has no build-code position`);
    return b36(i, width);
  };
  const v = pos('vehicles', build.vehicle, 1);
  const st = build.style === null ? NO_STYLE : pos('styles', build.style, 2);
  const levels = new Map<string, number | undefined>(Object.entries(build.levels));
  const lv = order.slots.map((s) => b36(Math.min(MAX_LEVEL, levels.get(s) ?? 0), 1)).join('');
  const pt = build.parts.map((id) => pos('parts', id, 2)).join('');
  const ab = build.abilities.map((id) => pos('abilities', id, 2)).join('');
  const fv = build.favours.map((id) => pos('favours', id, 2)).join('');
  return `gr2-${build.mode === 'campaign' ? 'c' : 'm'}${v}${st}${lv}.${pt}.${ab}.${fv}`.replace(/\.+$/, '');
}

/**
 * Decodes a build code. Positions that no longer exist (retired or out of range) are skipped, a style from the other
 * mode keeps the mode's default style, and favours only load in Campaign, all as the legacy planner did.
 */
export function decodeBuild(code: string, data: PlannerData = planner, order: BuildOrder = defaultOrder): Build {
  const m = CODE_RX.exec(code.trim());
  if (!m) throw new BuildCodeError("That build code isn't valid. Copy it again from the planner and paste the whole code.");
  const [, mode, vehicle, style, levels = '', parts, abilities, favours] = m;
  const pairs = (s: string | undefined): number[] => (s?.match(/../g) ?? []).map((x) => parseInt(x, 36));
  /** Resolves positions to ids that still exist in the data, dropping retired or unknown ones. */
  const resolve = <T extends string>(kind: OrderKind, current: readonly { id: T }[], positions: number[]): T[] => {
    const byId = new Map<string, T>(current.map((x) => [x.id, x.id]));
    return positions.map((i) => byId.get(order[kind][i] ?? '')).filter((id) => id !== undefined);
  };

  const b = freshBuild(mode === 'c' ? 'campaign' : 'mp', data);
  const [vehicleId] = resolve('vehicles', data.vehicles, [Number(vehicle)]);
  b.vehicle = vehicleId ?? resolve('vehicles', data.vehicles, [0])[0] ?? b.vehicle;
  const st = data.styles.find((s) => s.id === order.styles[parseInt(style ?? '', 36)]);
  if (style === NO_STYLE) b.style = null;
  else if (st?.mode === b.mode) b.style = st.id;
  data.slots.forEach((s) => {
    const i = order.slots.indexOf(s.id);
    b.levels[s.id] = Math.min(MAX_LEVEL, parseInt(levels[i] ?? '0', 36));
  });
  b.parts = resolve('parts', data.affixes, pairs(parts)).slice(0, data.meta.partSlots.max);
  b.abilities = fitAbilities(data, resolve('abilities', data.abilities, pairs(abilities)));
  b.favours = b.mode === 'campaign' ? resolve('favours', data.favours, pairs(favours)) : [];
  return b;
}
