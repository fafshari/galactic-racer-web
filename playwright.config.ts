import { defineConfig, devices } from '@playwright/test';

// In-browser checks (ADR 0013). The site's specs run against the production build on its own port, so a running
// `npm run dev` (which also serves dev-only pages) is never mistaken for it. The component showcase only exists under
// `astro dev`, and Astro allows one dev server per project, so its spec uses the dev server, reusing one already running.
const PREVIEW = 4322;
const SHOWCASE = 4321;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: { trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', testIgnore: /showcase/, use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PREVIEW}` } },
    { name: 'phone', testIgnore: /showcase/, use: { ...devices['Pixel 7'], baseURL: `http://localhost:${PREVIEW}` } },
    { name: 'showcase', testMatch: /showcase/, use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${SHOWCASE}` } },
    { name: 'showcase-phone', testMatch: /showcase/, use: { ...devices['Pixel 7'], baseURL: `http://localhost:${SHOWCASE}` } },
  ],
  webServer: [
    { command: `npm run preview -- --port ${PREVIEW}`, url: `http://localhost:${PREVIEW}`, reuseExistingServer: false },
    { command: `npm run dev -- --port ${SHOWCASE}`, url: `http://localhost:${SHOWCASE}/components`, reuseExistingServer: !process.env.CI, timeout: 120_000 },
  ],
});
