// Top speed and boost bonuses for the readout (ADR 0009). The game stores speeds in mph; the UI shows km/h.
import type { PlannerData } from '../data/types.ts';
import type { Build } from './build.ts';
import type { Evaluation } from './evaluate.ts';
import { isModifier, isNumberList, type CellValue } from './ops.ts';

export const KMH_PER_MPH = 1.609344;
export const toKmh = (mph: number): number => mph * KMH_PER_MPH;

export interface Speeds {
  /** Top speed with this build and the counted situational effects (mph). */
  top: number;
  /** The vehicle's top speed with nothing applied (mph). */
  baseTop: number;
  /** Extra top speed while each boost is active (mph). */
  afterburner: number;
  ramjet: number;
  /** False when the Ramjet bonus's base isn't in the data and only this build's change is known. */
  ramjetKnown: boolean;
  /** Held for as long as you're Surging. */
  surge: number;
  /** The short spike when Surging starts. */
  surgeBurst: number;
}

/** A tuned value from the evaluation, falling back to the vehicle's base value when the build doesn't change it. */
function fieldValue(data: PlannerData, build: Build, result: Evaluation, cfg: string, field: string, cell = ''): CellValue | undefined {
  const c = result.rows.find((r) => r.cfg === cfg && r.field === field)?.cells.find((x) => x.cell === cell);
  if (c) return c.value;
  const base = data.vehicles.find((v) => v.id === build.vehicle)?.configs[cfg]?.[field];
  if (isNumberList(base)) return base[Number(cell)];
  return typeof base === 'number' || typeof base === 'boolean' ? base : undefined;
}

const num = (v: CellValue | undefined): number => (typeof v === 'number' ? v : 0);

export function speeds(data: PlannerData, build: Build, result: Evaluation): Speeds {
  const top = fieldValue(data, build, result, 'VehicleThrustConfig', 'HighSpeedStep', '1');
  const baseConfig = data.vehicles.find((v) => v.id === build.vehicle)?.configs.VehicleThrustConfig?.HighSpeedStep;
  const ramjet = fieldValue(data, build, result, 'VehicleRamjetConfig', 'TopSpeedIncreaseMph');
  return {
    top: num(top),
    baseTop: isNumberList(baseConfig) ? (baseConfig[1] ?? 0) : 0,
    afterburner: num(fieldValue(data, build, result, 'VehicleAfterburnerConfig', 'TopSpeedIncreaseMph')),
    ramjet: ramjet === undefined || typeof ramjet === 'boolean' ? 0 : isModifier(ramjet) ? ramjet.add * ramjet.mul : ramjet,
    ramjetKnown: typeof ramjet === 'number',
    surge: num(fieldValue(data, build, result, 'VehicleThrustConfig', 'SurgeOngoingTopSpeedIncreaseMph')),
    surgeBurst: num(fieldValue(data, build, result, 'VehicleThrustConfig', 'SurgeBoostTopSpeedIncreaseMph')),
  };
}
