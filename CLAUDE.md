# Galactic Racer Web

Fan-made theorycrafting site for STAR WARS: Galactic Racer: a **build planner** (Multiplayer Tour and Campaign) and a **Multiplayer Tour simulator**, built from values datamined out of the game files.

> **Status: migration in progress.** This repo is being set up as the new home of the site (Astro + Svelte, deployed on Vercel). Until the migration lands, the live site is still the legacy single-file build described under "Legacy site". Update this file as each piece lands; once the migration is done, delete the legacy section.

Architecture decisions live in [`docs/adr/`](docs/adr/README.md). Read the relevant ADR before changing an area, and add or supersede an ADR when a decision changes.

## Two projects, one boundary

| | Path | Version control | Purpose |
|---|---|---|---|
| **Datamine** | `C:\Users\info\swgr-datamine` | **Never** (keep it out of git) | Extracts game files, builds `planner.json` and icons |
| **Web** (this repo) | `C:\Users\info\galactic-racer-web` | git, private GitHub repo under **fafshari** | The site: Astro pages, Svelte components, engine, tests |

The only things that cross from datamine to web are the **exported data files** (`planner.json` and icon images). See [ADR 0002](docs/adr/0002-separate-datamine-and-web.md).

## Hard rules

- **Never commit or publish game files, dumps, mappings (`.usmap`) or the extraction tools.** Only the exported planner data belongs in this repo.
- **GitHub account is `fafshari`**, never `ro-fafshari`. Commit as `Farzad Afshari <1194550+fafshari@users.noreply.github.com>` (already set in this repo's git config).
- **Push and deploy only when the user asks.** Commit only when asked.
- **Don't inject into or modify the running game.** Data comes from reading game files only.
- Keep the fan-made / not-affiliated notice on every page.

## Target stack (what this repo is becoming)

- **Astro**, static output, deployed on **Vercel** (Hobby plan: non-commercial, so no ads or paid features). [ADR 0003](docs/adr/0003-astro-static-site.md), [ADR 0011](docs/adr/0011-vercel-hosting.md)
- **Svelte 5** for anything interactive (Astro islands). Static content stays in `.astro`. [ADR 0004](docs/adr/0004-svelte-islands.md)
- **TypeScript in strict mode** everywhere, checked in CI. [ADR 0007](docs/adr/0007-typescript-strict.md)
- **Styling:** scoped `<style lang="scss">` blocks per component, named with **RSCSS**. Global CSS is design tokens and base styles only. No CSS Modules, no utility framework. [ADR 0005](docs/adr/0005-scoped-scss-with-rscss.md)
- **Component library** in `src/components/`, showcased on a `/components` page (no Storybook for now). [ADR 0006](docs/adr/0006-component-library.md)
- **Engine** (build evaluation, synergy scoring, build codes) as framework-free TypeScript in `src/lib/`. [ADR 0008](docs/adr/0008-framework-free-engine.md)
- **Tests:** Vitest for engine and logic, Playwright for in-browser checks. [ADR 0013](docs/adr/0013-testing.md)

### Styling conventions (RSCSS inside scoped blocks)

- Component root: two words, kebab-case: `.part-card`, `.stat-row`.
- Elements: one word, reached with the child selector: `.part-card > .title`.
- Variants: dash prefix: `.part-card.-legendary`, `.stat-row.-compact`.
- Helpers: underscore prefix, global only: `._visually-hidden`.
- Colours, fonts, spacing and radii come from CSS variables in the global token file; never hard-code a theme colour in a component. Every token has light and dark values.
- Nest at most one level below the component root.

### TypeScript conventions

- `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- No `any`. Use `unknown` and narrow it. No non-null `!` assertions except with a comment saying why it's safe.
- Game data is typed in one place (`src/lib/data/types.ts`) and validated once when loaded; components receive typed data, never raw JSON.
- Prefer discriminated unions over optional flags; prefer `satisfies` for typed constants.

## Build page UX direction

From [ADR 0012](docs/adr/0012-build-overview-ux.md): the build page becomes an **overview** modelled on the game's build summary screen:
- vehicle stats with pips and top speed
- racer style and its traits
- the four ability slots
- installed parts

The **readout** sits in a column beside it. Clicking a slot or "Add part" opens a **slide-over drawer** picker instead of long lists. **The drawer closes after every selection.** On phones the columns stack and the drawer becomes a full-screen bottom sheet. The tour simulator gets the same overhaul.

The `/components` showcase is **development only**: the route is injected for `astro dev` and never built for production.

## Game-mechanics model (don't break these)

From [ADR 0009](docs/adr/0009-game-mechanics-model.md); details and confidence levels are in the ADR.
- **Combine order (assumed):** a tuned value is `(base + Σadd + base·Σmultiple) · Πmultiply`.
- **Code defaults:** values missing from the cooked data are code defaults shared by every vehicle. They show as "of default" when the base is unknown.
- **Measured values** override missing defaults and are flagged as measured. Ramjet top-speed bonus = 80 mph (measured and confirmed).
- **Units:** speeds are stored in mph and shown in km/h (× 1.609344).
- **Power:** each Power point is one step of the power tuneset (+2.5 mph top speed, more on Podracer). Situational "increase Speed" effects add Power too. The engine caps total Power at 60; whether the game does is **unknown**.
- **Parts (confirmed):** grouped by family, and a build holds one rarity per family.
  - In a tour, owning a part removes its lower rarities from every offer.
  - A higher rarity, if offered, is a buy-and-replace upgrade into the same slot.
  - The tour sim enforces both: fixed in the legacy version on 2026-11-01, and the port must keep them, with tests.

## Build codes (public contract)

- Format: `gr2-{m|c}{vehicle}{style b36×2}{6 levels}.{parts}.{abilities}.{favours}`, stored in the URL hash.
- Trailing sections may be missing: chat apps strip trailing dots.
- **Old links must keep loading.** Any format change needs a new prefix and a decoder for the old one. [ADR 0010](docs/adr/0010-build-codes.md)

## Legacy site (until the migration is done)

The live site is built from the datamine folder:

- `swgr-datamine/planner/template.html`, `tour.html`: page templates (CSS + inline JS).
- `engine.js`, `synergy.js`: shared logic. `labels.json`: field labels.
- `swgr-datamine/site/`: a git repo that publishes to GitHub Pages at https://fafshari.github.io/galactic-racer-planner/ (built files only).

Rebuild and check (run from `C:\Users\info\swgr-datamine`, Git Bash):

```bash
python py/build_planner_data.py out
node planner/test-engine.js out/planner.json
(cd planner && node check-labels.js labels.json ../out/planner.json)
python planner/render.py out/planner.json "$TEMP/swgr-build/planner.html" "$(pwd -W)/planner/template.html"
python planner/render.py out/planner.json "$TEMP/swgr-build/tour-r.html" "$(pwd -W)/planner/tour.html"
python planner/build_site.py "$TEMP/swgr-build/planner.html" site index.html
python planner/build_site.py "$TEMP/swgr-build/tour-r.html" site tour.html
node planner/check-page.js site/index.html
node planner/check-tour.js site/tour.html
```

- `render.py` needs an **absolute** template path.
- `check-labels.js` must run from `planner/`.
- Files there use CRLF line endings; keep them when editing.

## Datamine pipeline (reference)

Lives in `swgr-datamine`; not part of this repo.
- **Extractor:** `SwgrDump` (C#, CUE4Parse). Game is UE 5.7, IoStore, Oodle, no encryption. It writes JSON to `out/json`.
- **Mappings:** the community `.usmap` in `mappings/`. The newest file is used, and it must match the game build.
- **Data build:** `py/build_planner_data.py out` writes `out/planner.json`. It covers vehicles, styles, traits, abilities, parts (affixes), favours, tunesets and tour data, with keyword highlights from the game's `<H1>` text tags.
- **After a game patch:** re-extract, rebuild `planner.json`, run the checks, then re-export into this repo. Ask the user before publishing.

## Commands (web)

None yet; the Astro project hasn't been scaffolded. Fill this in when it is (dev, build, check, test, e2e, data import).
