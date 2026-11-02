// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import SituationalEffect from './SituationalEffect.svelte';

const base = { owner: 'Reload Surge', detail: 'Tracked Vehicle Condition: Surging', desc: 'While Surging, abilities reload faster.' };

describe('SituationalEffect', () => {
  it('toggles an on/off effect', async () => {
    const onchange = vi.fn();
    render(SituationalEffect, { ...base, repeatable: false, value: undefined, onchange });
    const box = screen.getByRole('checkbox', { name: 'Reload Surge' });
    await fireEvent.click(box);
    expect(onchange).toHaveBeenLastCalledWith(true);
  });

  it('counts a stacking effect, clamped to 0–50, with 0 meaning off', async () => {
    const onchange = vi.fn();
    render(SituationalEffect, { ...base, owner: 'Calibrating Landings I', repeatable: true, value: 2, onchange });
    const input = screen.getByRole('spinbutton', { name: /Calibrating Landings I/ });
    expect((input as HTMLInputElement).value).toBe('2');
    await fireEvent.input(input, { target: { value: '7' } });
    expect(onchange).toHaveBeenLastCalledWith(7);
    await fireEvent.input(input, { target: { value: '999' } });
    expect(onchange).toHaveBeenLastCalledWith(50);
    await fireEvent.input(input, { target: { value: '0' } });
    expect(onchange).toHaveBeenLastCalledWith(undefined);
  });

  it('describes what sets it off', () => {
    render(SituationalEffect, { ...base, repeatable: true, value: undefined, onchange: vi.fn() });
    expect(screen.getByText(/Stacks each time it triggers\. Tracked Vehicle Condition: Surging — While Surging/)).toBeTruthy();
  });

  it('counts a time-based effect in seconds', async () => {
    const onchange = vi.fn();
    render(SituationalEffect, { owner: 'Potential Energy (trait)', detail: 'Each second airborne', repeatable: false, perSecond: 'airborne', value: undefined, onchange });
    const input = screen.getByRole('spinbutton', { name: 'Potential Energy (trait) seconds airborne' });
    await fireEvent.input(input, { target: { value: '4' } });
    expect(onchange).toHaveBeenLastCalledWith(4);
    expect(screen.getByText(/^Each second airborne/)).toBeTruthy();
  });
});
