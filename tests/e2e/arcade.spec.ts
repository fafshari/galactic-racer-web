// The Arcade page in a real browser, against the production build.
import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => document.querySelector('astro-island[ssr]') === null);
};
const card = (page: Page, name: string) => page.getByRole('article', { name, exact: true });

test('shows the events as on the game screen, with medal times and locks', async ({ page }) => {
  await page.goto('/arcade.html');
  await expect(page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Arcade' })).toHaveAttribute('aria-current', 'page');
  const first = page.getByRole('region', { name: 'Field Test events' }).getByRole('article').first();
  await expect(first).toHaveAccessibleName('Landspeeder Ace');
  await expect(first).toContainText('Jakku');
  await expect(first.getByRole('list', { name: 'Medal times' })).toHaveText(/01:19.*01:28.*02:44/);
  await expect(first.locator('.lock')).toHaveCount(0);
  await expect(card(page, 'Speeder Bike Ace')).toContainText('Lantaana');
  await expect(card(page, 'Speeder Bike Ace')).toContainText('Earn Bronze on Landspeeder Ace.');
  await expect(page.locator('.site-footer')).toContainText(/not affiliated/i);
});

test('opens an event vehicle in the planner with no racer style and its levels', async ({ page }) => {
  await page.goto('/arcade.html');
  await card(page, 'Landspeeder Ace').getByRole('link', { name: 'Open in the planner' }).click();
  await ready(page);
  await expect(page.locator('.build-planner > .toolbar > .status')).toHaveText('Build loaded from the link.');
  await expect(page.locator('.vehicle-name')).toHaveText('Landspeeder');
  await expect(page.locator('.style-panel .titles .name')).toHaveText('No racer style');
  await expect(page.getByRole('group', { name: 'Resilience level' }).getByRole('button', { name: 'Level 5' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('group', { name: 'Game mode' }).getByRole('button', { name: 'Campaign' })).toHaveAttribute('aria-pressed', 'true');
});

test('no sideways page scrolling: the card rows scroll on their own', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/arcade.html');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
});
