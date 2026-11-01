// The component showcase in a real browser: what jsdom can't check (native dialog and popover, layout).
import { expect, test, type Page } from '@playwright/test';

const errorsOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
};

test.beforeEach(async ({ page }) => {
  await page.goto('/components');
  await expect(page.getByRole('heading', { name: 'Basics' })).toBeVisible();
  // Astro drops the `ssr` attribute once an island has hydrated; clicks before that do nothing.
  await page.waitForFunction(() => document.querySelector('astro-island[ssr]') === null);
});

test('renders in both themes without errors or sideways scrolling', async ({ page }) => {
  const errors = errorsOf(page);
  for (const theme of ['Dark', 'Light']) {
    await page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: theme }).click();
    await expect(page.locator('.showcase')).toHaveAttribute('data-theme', theme.toLowerCase());
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
  expect(errors).toEqual([]);
});

test('the drawer is a proper dialog: focus moves in, Escape closes it, focus returns', async ({ page }) => {
  const opener = page.getByRole('button', { name: 'Add a part' });
  await opener.click();
  const drawer = page.getByRole('dialog', { name: 'Add a part' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('searchbox', { name: 'Search parts' })).toBeFocused();

  // the page behind can't be reached: a point outside the panel lands on the dialog's own backdrop
  const hitsBackdrop = await page.evaluate(() => document.elementFromPoint(5, 5)?.closest('dialog') !== null);
  expect(hitsBackdrop).toBe(true);

  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test('the drawer closes from its close button and from a click outside', async ({ page }) => {
  const opener = page.getByRole('button', { name: 'Add a part' });
  const drawer = page.getByRole('dialog', { name: 'Add a part' });
  await opener.click();
  await drawer.getByRole('button', { name: 'Close' }).click();
  await expect(drawer).not.toBeVisible();

  await opener.click();
  await expect(drawer).toBeVisible();
  await page.mouse.click(5, 300);
  await expect(drawer).not.toBeVisible();
});

test('searching filters the cards in the drawer', async ({ page }) => {
  await page.getByRole('button', { name: 'Add a part' }).click();
  const drawer = page.getByRole('dialog', { name: 'Add a part' });
  await drawer.getByRole('searchbox', { name: 'Search parts' }).fill('cooled');
  const cards = drawer.getByRole('article');
  await expect(cards.first()).toBeVisible();
  for (const text of await cards.allTextContents()) expect(text.toLowerCase()).toContain('cool');
});

test('an info tip opens next to its button and closes on Escape', async ({ page }) => {
  const button = page.getByRole('button', { name: 'About Top speed' });
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const tip = page.getByText('Your top speed with no boost active');
  await expect(tip).toBeVisible();
  // placed just below the button, or just above it when there's no room underneath
  const [b, p] = await Promise.all([button.boundingBox(), page.locator('.info-panel:popover-open').boundingBox()]);
  if (!b || !p) throw new Error('no boxes');
  const gapBelow = p.y - (b.y + b.height);
  const gapAbove = b.y - (p.y + p.height);
  expect((gapBelow >= 0 && gapBelow < 20) || (gapAbove >= 0 && gapAbove < 20)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(tip).not.toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
});

test('pips, rarity chips and counters update the build', async ({ page }) => {
  const top = page.locator('.speed-panel .poster .number');
  const before = await top.textContent();
  await page.getByRole('group', { name: 'Cornering level' }).getByRole('button', { name: 'Level 10' }).click();
  await expect(top).not.toHaveText(before ?? '');

  const toggle = page.getByRole('group', { name: 'Afterburner Efficiency rarity' });
  await toggle.getByRole('button', { name: 'Legendary' }).click();
  await expect(toggle.getByRole('button', { name: 'Legendary' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Afterburner Efficiency IV')).toBeVisible();
});
