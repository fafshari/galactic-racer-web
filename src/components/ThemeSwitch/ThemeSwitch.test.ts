// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { THEME_KEY } from '~/lib/theme.ts';
import ThemeSwitch from './ThemeSwitch.svelte';

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('ThemeSwitch', () => {
  it('follows the device until a theme is picked', () => {
    render(ThemeSwitch);
    expect(screen.getByRole('button', { name: 'Match device theme' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('applies and remembers a picked theme', async () => {
    render(ThemeSwitch);
    await fireEvent.click(screen.getByRole('button', { name: 'Light theme' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(screen.getByRole('button', { name: 'Light theme' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('going back to auto clears the override', async () => {
    localStorage.setItem(THEME_KEY, 'dark');
    document.documentElement.dataset.theme = 'dark';
    render(ThemeSwitch);
    await fireEvent.click(screen.getByRole('button', { name: 'Match device theme' }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it('shows the saved theme', async () => {
    localStorage.setItem(THEME_KEY, 'dark');
    render(ThemeSwitch);
    await Promise.resolve();
    expect(screen.getByRole('button', { name: 'Dark theme' }).getAttribute('aria-pressed')).toBe('true');
  });
});
