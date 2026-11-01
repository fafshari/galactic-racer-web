# 0003. Astro as a static site

- Status: Accepted
- Date: 2026-11-01

## Context

The legacy site is two self-contained HTML files (about 3.6 MB each) built by string replacement in `render.py`:
- **Data and icons twice:** the same 460 KB of data and 544 base64 icons are inlined into both pages, so a visitor downloads them twice and nothing is cached separately.
- **CSS twice:** theme tokens and shared CSS are copied into both templates, so a theme change has to be patched twice.
- **Only two pages:** making per-item pages (parts, abilities, traits) would be impractical.

All game data is known at build time, and nothing needs a server at request time.

## Decision

- Use **Astro** with **static output**. Every page is pre-rendered at build time, with no server runtime.
- **Pages:** `index` (build planner), `tour` (tour simulator) and `components` (ADR 0006).
- **Shared layout:** one shared layout component holds the theme, fonts, header and footer.
- **Interactive parts** are Svelte islands (ADR 0004). Everything else is `.astro` and ships no JavaScript.
- **URL compatibility:** the planner must still answer at `/` and `/index.html`, and the tour at `/tour.html` (`build.format: 'file'` or redirects). Build codes in the URL hash keep working (ADR 0010).

## Consequences

- One source of truth for layout and tokens.
- Data and icons become separate, cacheable files (ADR 0014).
- Static per-item pages generated from `planner.json` become cheap later. They aren't in scope for the migration, but they're the main long-term reason to choose Astro over a single-page tool.
- A Node toolchain is needed to build. The output is still plain static files, so hosting stays simple (ADR 0011).
- The claude.ai artifact copy of the planner (a single self-contained file) no longer follows from the build. It's retired once the Vercel site is live.
