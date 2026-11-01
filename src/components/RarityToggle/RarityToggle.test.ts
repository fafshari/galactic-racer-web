// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import RarityToggle from './RarityToggle.svelte';

describe('RarityToggle', () => {
  it('marks the current rarity and disables ones the part lacks', () => {
    render(RarityToggle, { value: 'Epic', available: ['Epic', 'Legendary'], onchange: vi.fn() });
    expect(screen.getByRole('button', { name: 'Epic' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Legendary' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Common' }).disabled).toBe(true);
  });

  it('reports the picked rarity', async () => {
    const onchange = vi.fn();
    render(RarityToggle, { value: 'Rare', available: ['Common', 'Rare', 'Epic', 'Legendary'], onchange });
    await fireEvent.click(screen.getByRole('button', { name: 'Legendary' }));
    expect(onchange).toHaveBeenCalledWith('Legendary');
  });
});
