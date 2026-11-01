# 0006. In-repo component library with a /components page

- Status: Accepted
- Date: 2026-11-01

## Context

The legacy UI already has a recognisable set of parts:
- part cards (reward-screen style, with a rarity strip)
- rarity toggles (C/R/E/L chips in white, bronze, silver and gold)
- stat pip rows (dots for levels 1–7, blocks for 8–10)
- the top-speed poster card and speed tiles
- choice cards (vehicle, style)
- tags, buttons, the mode switch (pill tabs)
- info tooltips
- situational-effect rows with stack counters
- What-changes rows

The migration is the moment to turn these into a reusable component library.

Storybook was considered:
- It's free and open source (MIT), with optional paid services (Chromatic) that we don't need.
- It's an extra toolchain to maintain, it needs a story file per component, and it can't render `.astro` components.

## Decision

- **Location:** components live in `src/components/`, one folder per component when it has more than one file. Each folder holds the component, its types, and its examples.
- **Showcase:** a `/components` page renders every component in every variant, in light and dark themes. It's built from the same code the site uses, so it can't drift.
  - **Development only:** the page exists only when running the dev server. It's added through a small Astro integration that injects the route only for `astro dev`, so it's never in the production build and isn't reachable on the live site.
- **Naming:** PascalCase file names (`PartCard.svelte`). The RSCSS root class is the kebab-case form (`.part-card`).
- **Props:** each component exports a typed props interface (ADR 0007). Variants are union-typed props, mapped to RSCSS variant classes.
- **No Storybook for now.** Revisit it if the library outgrows a single page, or if visual regression testing becomes worth paying for.

## Consequences

- No extra tooling or cost.
- The showcase isn't public, so it can't be shared by link. Running it means checking out the repo and starting the dev server.
- Playwright can still screenshot the `/components` page for cheap visual checks (ADR 0013), by running against the dev server instead of the production build.
