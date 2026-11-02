import { describe, expect, it } from 'vitest';
import { planner } from './index.ts';
import type { TraitId } from './types.ts';

const desc = (id: string): string => planner.traits[id as TraitId]?.desc ?? '';

describe('trait text', () => {
  it('fills {perc} from each trait\'s own rules', () => {
    expect(desc('TRT_AfterburnerRefillOnPerfectLanding')).toContain('next use by 100%.'); // Repulsor Fuel Link
    expect(desc('TRT_AfterburnerPowerStacksWhenAirborne')).toContain('bonus by +10%.'); // Potential Energy
    expect(desc('TRT_RefillAfterburnerOnOvertake')).toContain('tank by 10%.'); // Burn Bright
    expect(desc('TRT_RamjetExtendedAlarm')).toContain('increased by 100%.'); // Early Warning
    expect(desc('TRT_RamjetExtendedAlarmUpgrade')).toContain('an additional 100%.'); // Early Warning II
  });

  it('leaves no placeholder in any racer style\'s trait', () => {
    const left = planner.styles.flatMap((s) => s.traits.map((t) => planner.traits[t]?.desc ?? '')).filter((d) => /\{\w+\}/.test(d));
    expect(left).toEqual([]);
  });
});
