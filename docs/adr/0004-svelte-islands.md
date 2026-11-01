# 0004. Svelte for interactive islands

- Status: Accepted
- Date: 2026-11-01

## Context

Astro components render once at build time. Almost everything on the build page changes as you click: part cards, rarity toggles, stat pips, the readout, Situational effects. That UI needs a framework that runs in the browser.

Candidates with official Astro integrations: Svelte, Vue, Preact, React, Solid, Alpine.

The styling decision (ADR 0005) favours following Astro's own model, a scoped `<style>` block per component:
- **Svelte and Vue** share that model.
- **Preact, React and Solid** would need CSS Modules alongside Astro's scoped styles, giving two styling systems.

## Decision

- Use **Svelte 5** (runes) for every interactive component.
- **Mount each page's interactive area as one island** (for example a `BuildPlanner` island and a `TourSimulator` island). Avoid many small islands that would need to share state across island boundaries.
- **Shared build state:** one module of Svelte runes, used inside the island.
- **Static sections** (notes, headers, footers, the `/components` page frame) stay `.astro`.
- **Hydration:** `client:load` for the main island. `client:visible` for anything below the fold that's independent.

## Consequences

- One styling model across `.astro` and `.svelte` files.
- Small runtime: Svelte compiles to plain JavaScript.
- The legacy string-template UI is rewritten as Svelte components. This is the largest single piece of the migration, so regressions are guarded by the engine tests and Playwright checks (ADR 0013).
- The engine stays framework-free (ADR 0008), so the framework choice doesn't leak into the build logic.
