// The header's theme switch, against the production build.
import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => document.querySelector('astro-island[ssr]') === null);
};
const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.use({ colorScheme: 'dark' });

test('a picked theme overrides the device, survives navigation and a reload, and auto goes back', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const dark = await background(page);
  const theme = page.getByRole('group', { name: 'Colour theme' });

  await theme.getByRole('button', { name: 'Light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const light = await background(page);
  expect(light).not.toBe(dark);

  await page.getByRole('link', { name: 'Tour simulator' }).click();
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(theme.getByRole('button', { name: 'Light theme' })).toHaveAttribute('aria-pressed', 'true');
  expect(await background(page)).toBe(light);

  await page.reload();
  expect(await background(page)).toBe(light); // applied before hydration, no flash of the device theme

  await ready(page);
  await theme.getByRole('button', { name: 'Match device theme' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  expect(await background(page)).toBe(dark);
});
