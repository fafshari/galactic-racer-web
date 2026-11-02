// The tour simulator in a real browser, against the production build.
import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => document.querySelector('astro-island[ssr]') === null);
};
const stageTitle = (page: Page) => page.locator('.tour-stage > .title');

/** Starts a run and plays one race: first backer, the given bet, finishing P1. */
async function raceOnce(page: Page, bet: string): Promise<void> {
  await page.getByRole('button', { name: 'Start tour' }).click();
  await expect(stageTitle(page)).toContainText('choose a backer');
  await page.locator('.tour-stage .choice-card').first().click();
  await page.getByRole('button', { name: 'Next: place your bet' }).click();
  await page.locator('.tour-stage .choice-card').filter({ hasText: bet }).click();
  await page.getByRole('button', { name: 'Go to the race' }).click();
  await page.getByRole('button', { name: /^Position 1,/ }).click();
  await page.getByRole('spinbutton').fill('3');
  await page.getByRole('button', { name: 'Finish race' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/tour.html');
  await ready(page);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await ready(page);
});

test('plays a race through rewards to the shop', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await raceOnce(page, 'High Risk');
  await expect(stageTitle(page)).toHaveText('Jakku: Race completed');
  await expect(page.locator('.queue .item')).toHaveCount(2);

  await page.locator('.tour-stage .choice-card').first().click(); // the upgrade
  await expect(stageTitle(page)).toHaveText('Jakku: High Risk bet won');
  await page.locator('.tour-stage .part-card').first().getByRole('button', { name: 'Take', exact: true }).click();
  await expect(stageTitle(page)).toHaveText('Jakku: shop');
  await expect(page.locator('.owned .item')).toHaveCount(2); // starting ability + the part taken
  await expect(page.locator('.log .text').first()).toContainText('High Risk bet won:');
  expect(errors).toEqual([]);
});

test('the shop sells, rerolls for more each time, and moves on to the next planet', async ({ page }) => {
  await raceOnce(page, 'Low Risk');
  for (let guard = 0; guard < 4 && !(await stageTitle(page).textContent())?.endsWith('shop'); guard++) {
    await page.getByRole('button', { name: /^Skip/ }).or(page.locator('.tour-stage .choice-card').first()).first().click();
  }
  await expect(stageTitle(page)).toHaveText('Jakku: shop');
  const reroll = page.getByRole('button', { name: /^Reroll offers/ });
  const first = await reroll.textContent();
  await reroll.click();
  await expect(reroll).not.toHaveText(first ?? '');
  await page.getByRole('button', { name: /^Leave for/ }).click();
  await expect(stageTitle(page)).toHaveText('Lantaana: choose a backer');
  await expect(page.locator('.stops .stop.-done')).toHaveCount(1);
});

test('a run survives a reload, and the build opens in the planner', async ({ page }) => {
  await raceOnce(page, 'High Risk');
  const title = await stageTitle(page).textContent();
  await page.reload();
  await ready(page);
  await expect(stageTitle(page)).toHaveText(title ?? '');
  const href = await page.getByRole('link', { name: 'Open this build in the planner' }).getAttribute('href');
  expect(href).toMatch(/^\/#gr2-m/);
});

test('no sideways scrolling during a run', async ({ page }) => {
  await raceOnce(page, 'High Risk');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
