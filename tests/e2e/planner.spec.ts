// The build planner in a real browser, against the production build.
import { expect, test, type Page } from '@playwright/test';

// A link shared from the legacy planner: Speeder Bike, Clean Racer, levels 4 7 5 8 0 6, nothing else.
const SHARED = 'gr2-m106475806';

const ready = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => document.querySelector('astro-island[ssr]') === null);
};
const topSpeed = (page: Page) => page.locator('.speed-panel .poster .number');
// the toolbar's message line (the stat rows' <output> levels are status regions too)
const statusLine = (page: Page) => page.locator('.build-planner > .toolbar > .status');

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('a link shared from the legacy planner opens the same build with the same numbers', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/#${SHARED}`);
  await ready(page);
  await expect(statusLine(page)).toHaveText('Build loaded from the link.');
  await expect(page.locator('.vehicle-name')).toHaveText('Speeder Bike');
  await expect(topSpeed(page)).toHaveText('418');
  const tiles = page.locator('.speed-panel .boosts .number');
  await expect(tiles.nth(0)).toContainText('504');
  await expect(tiles.nth(1)).toContainText('597');
  await expect(tiles.nth(2)).toContainText('+24');
  await expect(page.getByRole('group', { name: 'Boost level' }).getByRole('button', { name: 'Level 8' })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('build a part in: add from the drawer, count its procs, change rarity, copy the link', async ({ page }) => {
  await page.goto(`/#${SHARED}`);
  await ready(page);

  const opener = page.getByRole('button', { name: 'Add part' });
  await opener.click();
  const drawer = page.getByRole('dialog', { name: 'Add a part' });
  await drawer.getByRole('searchbox', { name: 'Search parts' }).fill('calibrating');
  await drawer.getByRole('button', { name: 'Add Calibrating Landings I', exact: true }).click();
  await expect(drawer).not.toBeVisible(); // closes after the pick
  await expect(opener).toBeFocused();

  await page.getByRole('spinbutton', { name: /Calibrating Landings I/ }).fill('4');
  await expect(topSpeed(page)).toHaveText('435'); // the live planner shows 435 for this

  const rarity = page.getByRole('group', { name: 'Calibrating Landings rarity' });
  await rarity.getByRole('button', { name: 'Epic' }).click();
  await expect(page.locator('.part-row .name')).toHaveText('Calibrating Landings II');
  await expect(page.getByRole('spinbutton', { name: /Calibrating Landings II/ })).toHaveValue('4'); // count carried over

  await page.getByRole('button', { name: 'Copy build link' }).click();
  await expect(statusLine(page)).toHaveText('Build link copied. Anyone opening it gets this build.');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/#gr2-m106475806\.[0-9a-z]{2}$/);
});

test('one rarity per part family: an owned family shows as in build', async ({ page }) => {
  await page.goto(`/#${SHARED}`);
  await ready(page);
  await page.getByRole('button', { name: 'Add part' }).click();
  const drawer = page.getByRole('dialog', { name: 'Add a part' });
  await drawer.getByRole('searchbox', { name: 'Search parts' }).fill('Afterburner Efficiency');
  await drawer.getByRole('button', { name: 'Add Afterburner Efficiency I', exact: true }).click();
  await page.getByRole('button', { name: 'Add part' }).click();
  await drawer.getByRole('searchbox', { name: 'Search parts' }).fill('Afterburner Efficiency');
  await expect(drawer.getByRole('button', { name: 'In build' })).toBeDisabled();
});

test('edits survive a reload, and the stale link is dropped from the address bar', async ({ page }) => {
  await page.goto(`/#${SHARED}`);
  await ready(page);
  await page.getByRole('group', { name: 'Battery level' }).getByRole('button', { name: 'Level 3' }).click();
  await expect(page).not.toHaveURL(/#gr2-/);
  await page.reload();
  await ready(page);
  await expect(page.getByRole('group', { name: 'Battery level' }).getByRole('button', { name: 'Level 3' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.vehicle-name')).toHaveText('Speeder Bike');
});

test('Campaign: ranks, favours, and back to Multiplayer drops the favours', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('group', { name: 'Game mode' }).getByRole('button', { name: 'Campaign' }).click();
  await expect(page.getByRole('group', { name: 'Style rank' })).toBeVisible();
  await page.getByRole('button', { name: 'Add favour' }).click();
  const drawer = page.getByRole('dialog', { name: 'Add a favour' });
  await drawer.locator('.favour-row').first().getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('.favour-row')).toHaveCount(1);
  await page.getByRole('group', { name: 'Game mode' }).getByRole('button', { name: 'Multiplayer Tour' }).click();
  await expect(page.locator('.favour-row')).toHaveCount(0);
});

test('choosing a style brings its starting abilities; abilities fill and empty slots', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Choose a racer style' });
  const option = drawer.getByRole('button').filter({ hasText: 'Brawler' });
  await option.click();
  await expect(drawer).not.toBeVisible();
  await expect(page.locator('.style-panel .titles .name')).toContainText('Brawler');
  await expect(page.getByRole('button', { name: /^Ability 1: Ion Bolt/ })).toBeVisible();

  await page.getByRole('button', { name: 'Remove Ion Bolt' }).click();
  await expect(page.getByRole('button', { name: 'Ability 1: empty. Add an ability' })).toBeVisible();
});

test('pasting a bad code explains instead of breaking', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('textbox', { name: 'Build code' }).fill('not a code');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(statusLine(page)).toContainText("isn't valid");
});

test('no sideways scrolling, in either theme', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`/#${SHARED}`);
    await ready(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
});

test('What changes keeps labels readable next to long values', async ({ page }) => {
  // Ability Catalyst adds "Refill time (empty to full): 5 s → …", which once squeezed its label to a letter per line
  await page.goto(`/#${SHARED}`);
  await ready(page);
  await page.getByRole('button', { name: 'Add part' }).click();
  const drawer = page.getByRole('dialog', { name: 'Add a part' });
  await drawer.getByRole('searchbox', { name: 'Search parts' }).fill('Ability Catalyst');
  await drawer.getByRole('button', { name: 'Add Ability Catalyst', exact: true }).click();
  await page.getByRole('spinbutton', { name: /Ability Catalyst/ }).fill('2');
  await expect(page.locator('.change-row').filter({ hasText: 'Refill time' })).toBeVisible();
  const narrowest = await page.locator('.change-row .field').evaluateAll((els) => Math.min(...els.map((e) => e.getBoundingClientRect().width)));
  expect(narrowest).toBeGreaterThan(120);
  const overflowing = await page.locator('.change-row').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => `${e.querySelector('.field')?.textContent.trim().slice(0, 40) ?? ''} ${String(e.scrollWidth)}/${String(e.clientWidth)}`));
  expect(overflowing).toEqual([]);
});

test('every stat pip stays clickable and clear of the level, however narrow the row', async ({ page }) => {
  await page.goto(`/#${SHARED}`);
  await ready(page);
  const row = page.locator('.stat-row').first();
  for (const width of [620, 440, 439, 360, 300]) {
    await row.evaluate((el, w) => { el.style.width = `${String(w)}px`; }, width);
    // Playwright refuses to click a pip that something else (the level) covers
    await row.getByRole('button', { name: 'Level 10' }).click();
    await expect(row.locator('output')).toHaveText('10');
    const clear = await row.evaluate((el) => {
      const pips = el.querySelector('.stat-pips');
      const level = el.querySelector('output');
      if (!pips || !level) return false;
      const a = pips.getBoundingClientRect();
      const b = level.getBoundingClientRect();
      return pips.scrollWidth <= Math.ceil(a.width) && (a.right <= b.left || a.top >= b.bottom);
    });
    expect(clear, `row at ${String(width)}px`).toBe(true);
    await row.getByRole('button', { name: 'Level 3' }).click();
  }
});
