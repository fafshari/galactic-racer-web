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
