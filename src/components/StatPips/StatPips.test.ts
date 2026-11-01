// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import StatPips from './StatPips.svelte';

describe('StatPips', () => {
  it('lights one pip per level', () => {
    render(StatPips, { level: 4, label: 'Cornering', onchange: vi.fn() });
    const pressed = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(4);
  });

  it('sets the level of the clicked pip', async () => {
    const onchange = vi.fn();
    render(StatPips, { level: 4, label: 'Cornering', onchange });
    await fireEvent.click(screen.getByRole('button', { name: 'Level 9' }));
    expect(onchange).toHaveBeenCalledWith(9);
  });

  it('steps down one level when the highest lit pip is clicked again', async () => {
    const onchange = vi.fn();
    render(StatPips, { level: 1, label: 'Cornering', onchange });
    await fireEvent.click(screen.getByRole('button', { name: 'Level 1' }));
    expect(onchange).toHaveBeenCalledWith(0);
  });

  it('renders read-only pips without buttons', () => {
    render(StatPips, { level: 3, label: 'Boost' });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('img', { name: 'Boost level 3 of 10' })).toBeTruthy();
  });
});
