// Screenshot import (ADR 0016) in a real browser: paste from the clipboard, drop a file, review, apply.
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

const FIXTURE = new URL('../../src/lib/import/fixtures/campaign-skimmer-redliner-2000x1125.webp', import.meta.url);

const ready = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => document.querySelector('astro-island[ssr]') === null);
};
const statusLine = (page: Page) => page.locator('.build-planner > .toolbar > .status');
const drawer = (page: Page) => page.getByRole('dialog', { name: 'Import from a screenshot' });

/** The fixture as base64, to hand into the page. */
const fixture = async (): Promise<string> => (await readFile(FIXTURE)).toString('base64');

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('pasting a screenshot from the clipboard loads the build it shows', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await ready(page);

  // Put the screenshot on the real clipboard as a PNG (what a screenshot tool copies), then press Ctrl+V.
  await page.evaluate(async (b64) => {
    const webp = await (await fetch(`data:image/webp;base64,${b64}`)).blob();
    const bitmap = await createImageBitmap(webp);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    const png = await canvas.convertToBlob({ type: 'image/png' });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  }, await fixture());
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ControlOrMeta+V');

  await expect(drawer(page)).toBeVisible();
  await expect(drawer(page).getByText('Every slot was read clearly')).toBeVisible({ timeout: 60_000 });
  await expect(drawer(page).getByLabel('Racer style')).toHaveValue('CAM_Style_Ramjet_Lv3');
  await expect(drawer(page).getByLabel('Part 4')).toHaveValue('AFX_Landing_PerfectBoost_v3');
  await expect(drawer(page).getByText('Top speed 402 km/h matches the screenshot.')).toBeVisible();

  await drawer(page).getByRole('button', { name: 'Use this build' }).click();
  await expect(drawer(page)).toBeHidden();
  await expect(statusLine(page)).toHaveText('Build imported from the screenshot.');
  await expect(page.locator('.vehicle-name')).toHaveText('Skim Speeder');
  await expect(page.locator('.part-row')).toHaveCount(4);
  await expect(page.getByRole('group', { name: 'Boost level' }).getByRole('button', { name: 'Level 9' })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('dropping a screenshot opens the review, where a slot can be corrected before applying', async ({ page }) => {
  await page.goto('/');
  await ready(page);

  await page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/webp;base64,${b64}`)).blob();
    const data = new DataTransfer();
    data.items.add(new File([blob], 'build.webp', { type: 'image/webp' }));
    const target = document.querySelector('.build-planner');
    target?.dispatchEvent(new DragEvent('dragover', { dataTransfer: data, bubbles: true, cancelable: true }));
    target?.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }));
  }, await fixture());

  await expect(drawer(page).getByText('Every slot was read clearly')).toBeVisible({ timeout: 60_000 });
  await drawer(page).getByLabel('Part 4').selectOption({ label: 'Repulsormod II' });
  await drawer(page).getByLabel('Ability 2').selectOption({ label: 'Shield' });
  await drawer(page).getByRole('button', { name: 'Use this build' }).click();

  await expect(page.locator('.part-row').nth(3)).toContainText('Repulsormod II');
  await expect(page.getByRole('button', { name: /^Ability 2: Shield, Reload/ })).toBeVisible();
});

test('an image that is not the build screen gets a clear message', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Import screenshot' }).click();
  await drawer(page)
    .locator('input[type=file]')
    .setInputFiles({ name: 'grey.png', mimeType: 'image/png', buffer: await sharp({ create: { width: 800, height: 450, channels: 3, background: '#808080' } }).png().toBuffer() });
  await expect(drawer(page).getByRole('alert')).toContainText("doesn't look like the game's build screen");
  await drawer(page).locator('input[type=file]').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(drawer(page).getByRole('alert')).toContainText("couldn't be opened");
});
