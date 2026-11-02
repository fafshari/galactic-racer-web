// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import SituationalEffect from './SituationalEffect.svelte';

const base = { owner: 'Reload Surge', desc: 'While Surging, abilities reload faster.' };

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

  it('shows the game description, plus a plain "when" line only when given one', () => {
    const { unmount } = render(SituationalEffect, { ...base, repeatable: true, value: undefined, onchange: vi.fn() });
    expect(screen.getByText('Stacks each time it triggers. While Surging, abilities reload faster.')).toBeTruthy();
    expect(document.querySelector('.when')).toBeNull();
    unmount();
    render(SituationalEffect, { ...base, repeatable: false, when: 'Burning + Ramjet ready', value: undefined, onchange: vi.fn() });
    expect(screen.getByRole('checkbox', { name: 'Reload Surge' }).getAttribute('aria-describedby')).toMatch(/-when .*-detail$/);
    expect(screen.getByText('Burning + Ramjet ready')).toBeTruthy();
  });

  it('counts a time-based effect in seconds', async () => {
    const onchange = vi.fn();
    render(SituationalEffect, { owner: 'Potential Energy (trait)', repeatable: false, perSecond: 'airborne', value: undefined, onchange });
    const input = screen.getByRole('spinbutton', { name: 'Potential Energy (trait) seconds airborne' });
    await fireEvent.input(input, { target: { value: '4' } });
    expect(onchange).toHaveBeenLastCalledWith(4);
  });
});
