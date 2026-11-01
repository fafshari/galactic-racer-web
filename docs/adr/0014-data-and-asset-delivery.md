# 0014. Data and icons as separate cached files

- Status: Accepted
- Date: 2026-11-01

## Context

Each legacy page inlines `planner.json` (about 460 KB) and 544 icons as base64 in CSS. Pages are about 3.6 MB each. Opening the planner and then the tour simulator downloads everything twice, and nothing is cached separately. All 300 part art images load even though only a few are on screen.

## Decision

- **Icons and art** are exported from the datamine as image files (WebP, or PNG where transparency matters and WebP fails). They go through Astro's asset pipeline, so file names are hashed and long-cache headers apply.
  - Part art and other large images use `loading="lazy"` with explicit width and height.
  - Small glyph icons that are tinted with the theme use CSS masks over those files, as today.
- **Game data** is bundled as a hashed JSON module. It's imported by the islands, so both pages share one cached file.
  - If it grows, it's split by area (vehicles, parts, tour) so each page loads only what it needs.
- **Text and keyword highlights** stay in the data (`hl` arrays from the game's `<H1>` tags), not baked into HTML.

## Implementation (2026-11-01)

- **Icons:** the datamine already exports every icon as a sized WebP, with an index of size and glyph flag. They're copied as-is to `src/assets/icons/`, with no re-encoding.
  - `src/lib/data/index.ts` maps icon names to URLs with Vite's `import.meta.glob(..., { query: '?url' })`.
  - Vite emits each icon as its own hashed, cacheable file, and only icons a page actually renders get downloaded.
  - Astro's image optimizer isn't used: the files are already the right size and format, and the names are only known in the browser.
- **Game data:** `src/data/planner.json` is imported as a JSON module, which Vite bundles once and both pages share.

## Consequences

- First load should drop substantially and repeat visits should be nearly free. The exact numbers will be measured during the migration and recorded here.
- The datamine export has to produce image files and a stable naming scheme, not only the base64 CSS it produces today.
- Offline use from a saved single file is no longer possible. That was only ever a side effect of the single-file build.
