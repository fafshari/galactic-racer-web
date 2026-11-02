// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import type { Speeds } from '~/lib/engine/speeds.ts';
import SpeedPanel from './SpeedPanel.svelte';

const speeds = (s: Partial<Speeds>): Speeds => ({ top: 200, baseTop: 180, afterburner: 40, ramjet: 80, ramjetKnown: true, surge: 15, surgeBurst: 50, ...s });
const faster = (s: Partial<Speeds>): string[] => {
  const { container } = render(SpeedPanel, { speeds: speeds(s) });
  // the heading's own name, and whether it tells screen readers why it stands out
  return [...container.querySelectorAll('.tile.-faster > .heading')].map((h) => `${h.firstChild?.textContent ?? ''}${h.querySelector('._visually-hidden')?.textContent ?? ''}`);
};

describe('SpeedPanel', () => {
  it('highlights the faster of Afterburner and Ramjet', () => {
    expect(faster({ afterburner: 40, ramjet: 80 })).toEqual(['Ramjet, the faster boost']);
    expect(faster({ afterburner: 90, ramjet: 80 })).toEqual(['Afterburner, the faster boost']);
  });

  it('highlights neither on a tie, or when Afterburner only beats an unknown Ramjet', () => {
    expect(faster({ afterburner: 80, ramjet: 80 })).toEqual([]);
    expect(faster({ afterburner: 90, ramjet: 10, ramjetKnown: false })).toEqual([]);
  });

  it('shows Surge as sustained/burst', () => {
    const { container } = render(SpeedPanel, { speeds: speeds({ surge: 15, surgeBurst: 50 }) });
    expect(container.querySelectorAll('.tile .number')[2]?.textContent).toMatch(/^\+24\/80\s*km\/h$/);
  });
});
