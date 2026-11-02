import { expect, test } from '@playwright/test';

const pages = [
  { path: '/', title: 'Galactic Racer Build Planner' },
  { path: '/index.html', title: 'Galactic Racer Build Planner' },
  { path: '/tour.html', title: 'Galactic Racer Tour Simulator' },
];

for (const { path, title } of pages) {
  test(`${path} loads cleanly`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByText('Fan-made tool. Not affiliated')).toBeVisible();

    // no sideways scrolling at any width
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test('the component showcase is not in the production build', async ({ page }) => {
  const response = await page.goto('/components');
  expect(response?.status()).toBe(404);
});

test('link previews (Discord, Slack, ...) get a title, description and a 1200×630 image', async ({ page, request }) => {
  await page.goto('/tour.html');
  const meta = (property: string) => page.locator(`meta[property="${property}"]`).getAttribute('content');
  expect(await meta('og:title')).toBe('Galactic Racer Tour Simulator');
  expect(await meta('og:description')).toBeTruthy();
  expect(await meta('og:url')).toMatch(/^https:\/\/[^/]+\/tour\.html$/);
  const image = await meta('og:image');
  expect(image).toMatch(/^https:\/\/[^/]+\/og\.png$/);
  // served by this build (the absolute URL points at production, so fetch its path here)
  const res = await request.get(new URL(image ?? '').pathname);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
});

