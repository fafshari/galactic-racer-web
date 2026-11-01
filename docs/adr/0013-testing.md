# 0013. Vitest and Playwright

- Status: Accepted
- Date: 2026-11-01

## Context

The legacy site is checked by ad-hoc Node scripts:
- `test-engine.js`: engine maths.
- `check-labels.js`: every changed field has a label.
- `check-page.js`, `check-tour.js`: they parse the built single file and evaluate a build.
- `check-synergy.js`, `check-offer.js`: tour scoring.

They caught real bugs, like an unescaped apostrophe that broke a page. But the page checks depend on the single-file build, which goes away (ADR 0003).

## Decision

- **Vitest** for everything that runs without a browser:
  - engine, synergy, tour simulation, build codes
  - data validation
  - Svelte component logic (with `@testing-library/svelte` where a component has behaviour)
- **Port the legacy test cases first.** The legacy scripts' cases become Vitest tests before any behaviour change, as the regression baseline.
- **Playwright** for a small set of in-browser checks, run against the built site:
  - **Pages:** each page loads without console errors.
  - **Build codes:** a saved build link restores the same build, including links with trailing dots stripped.
  - **Planner flows:** pick a part, change its rarity, tick a situational effect, and the top speed updates.
  - **Drawer:** it opens and closes, with focus handled correctly.
  - **Layout:** no horizontal scroll at 375 px and at desktop width, in both light and dark themes.
- **CI:** type checks and lint (ADR 0007), Vitest, and Playwright run on every push. Vercel only deploys a commit that passes.
- **Tour part-family rule:** Vitest tests for the tour simulation cover the part-family rule from ADR 0009: no lower rarities of owned parts are offered, and a higher rarity replaces the owned part.
- **Label coverage:** every field the engine can change must have a human label. That becomes a Vitest test over the data.

## Consequences

- There are two test runners to maintain, each kept to what it's best at.
- Visual regression testing is out of scope for now. Playwright screenshots of `/components` can be added later (ADR 0006).
