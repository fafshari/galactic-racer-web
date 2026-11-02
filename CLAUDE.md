# Galactic Racer Web

Fan-made theorycrafting site for STAR WARS: Galactic Racer: a **build planner** (Multiplayer Tour and Campaign) and a **Multiplayer Tour simulator**, built from values datamined out of the game files.

> **Status: migration in progress.** Done so far:
> - the Astro scaffold: tooling, design tokens, layout and the first components (`Tag`, `StatPips`)
> - CI
> - the data contract: schema, import, permanent build-code order and icons
> - the engine, build codes, speed readout and synergy scorer, proven identical to the legacy ones
> - the component library (see "Components")
> - the build planner page (see "Build planner")
> - the tour simulator: its simulation and page (see "Tour simulator")
>
> The site isn't deployed to Vercel yet. Until it is, the live site is the legacy single-file build described under "Legacy site". Update this file as each piece lands; once the migration is done, delete the legacy section.

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
- **Positions come from `src/data/build-order.json`**, never from the order of the data arrays. That file matches the live legacy site, so every existing link decodes the same.
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
- **After a game patch:** re-extract, rebuild `planner.json`, run the legacy checks, then `npm run import-data` here (see "Game data"). Ask the user before publishing.
- **Labels exist twice for now:** the legacy pages read `swgr-datamine/planner/labels.json`, while this repo owns `src/data/labels.json`. Keep them in step until the legacy pages are retired.

## Commands (web)

Run from the repo root. Node ≥ 22.23.4.

```bash
npm run dev       # dev server at http://localhost:4321 (also serves the /components showcase)
npm run build     # static site into dist/
npm run preview   # serve dist/
npm run check     # astro check + svelte-check (fails on warnings)
npm run lint      # ESLint, type-checked
npm test          # Vitest
npm run e2e       # Playwright: the site on the production build, the showcase on the dev server (run `npx playwright install chromium` once)
npm run verify    # all of the above, in CI order
npm run import-data [-- <path to swgr-datamine>]   # re-import game data after the datamine rebuilds planner.json
```

- Run `npm run verify` before every commit that touches code.
- CI (`.github/workflows/ci.yml`) runs the same on every PR and push to `main`.
- **Playwright ports:**
  - The site's specs run against the production build on port 4322, so a running dev server never gets in the way.
  - The showcase spec (`tests/e2e/showcase.spec.ts`) runs against the dev server on 4321, reusing one that's already running. Astro allows only one dev server per project.

## Game data

- **Committed data:** `src/data/` holds the imported game data:
  - `planner.json`
  - `icons.json` (icon index)
  - `manifest.json` (game build, mappings, source hash)
  - `build-order.json`
  - `labels.json`

  Icons are WebP files in `src/assets/icons/`.
- **Imported files:** everything except `labels.json` and `build-order.json` is written only by `npm run import-data`. Don't edit them by hand.
- **`labels.json`** is hand-written and owned here. Add a label when the import reports a field without one.
- **`build-order.json`** fixes every id's permanent build-code position (ADR 0010). The import only appends new ids; never reorder or delete entries by hand, or shared links will load the wrong build.
- **Text placeholders:** the export leaves the game's `{perc}` in some trait descriptions. `src/lib/data/text.ts` fills them when the data loads, from each trait's own rules (its tuneset's percentage, or a refill amount). Favour descriptions and unlock texts still have `{perc}` / `{Target}`: their numbers aren't in the export.
- **Reading data:** go through `src/lib/data/index.ts`, which exports `planner`, `labels`, `buildOrder`, `manifest`, `iconUrl()` and `isGlyph()`. Never import the JSON files directly elsewhere.
- **Where the shape is defined:** the schema (`src/lib/data/schema.ts`) is the contract with the datamine, and the types (`types.ts`) are derived from it.
  - The schema uses strict objects, so a new or renamed field fails the import. Update the schema in the same change.
  - The data is validated on import, in `npm test`, and when every dev server or build starts.
- **After a game patch:**
  1. In the datamine, re-extract and run `python py/build_planner_data.py out`.
  2. Here, run `npm run import-data` and then `npm run verify`.
  3. Review the diff, especially new or retired ids in `build-order.json`.

## Project layout

```
src/
  pages/              index.astro, tour.astro (built as /index.html and /tour.html)
  layouts/            BaseLayout.astro: fonts, global styles, header, footer
  components/<Name>/  one folder per component: Name.svelte|astro and Name.test.ts
  dev/                pages that exist only under `astro dev`: components.astro + Showcase.svelte
  lib/format/         engine rows to display values (labels, units, curves, keyword runs), no HTML
  lib/planner/        planner rules as pure build → build functions, readout grouping, saved-build restore
  integrations/       dev-pages.ts (dev-only routes), validate-data.ts (data check on dev/build start), ocr-data.ts (serves OCR language data)
  styles/             global.scss, _tokens.scss (light/dark CSS variables), _breakpoints.scss
  lib/data/           schema, types, references and label checks, build-code order, loader (index.ts)
  lib/engine/         evaluate (tuned values), build codes, speeds, the Build type (index.ts re-exports)
  lib/synergy/        the tour recommender (createSynergy)
  lib/theme.ts        the visitor's saved colour theme (auto / light / dark)
  lib/import/         screenshot import: panel layout, OCR text matching, pip counting (ADR 0016)
  lib/tour/           tour simulation: seeded RNG, the tourAction reducer, offer fit labels, saved-run restore
  data/               imported game data (see "Game data")
  assets/icons/       game icons (WebP)
scripts/              import-data.ts (runs on Node's built-in TypeScript support)
tests/e2e/            Playwright specs
tests/legacy/         verbatim legacy engine.js / synergy.js, reference for parity tests only
docs/adr/             architecture decisions
```

- Import from `src` with the `~/` alias (`~/components/Tag/Tag.svelte`).
- Fonts are self-hosted through Astro's `fonts` config (Unbounded, Barlow, Barlow Semi Condensed, IBM Plex Mono) and exposed as `--font-display`, `--font-label`, `--font-body` and `--font-mono`.
- **Theme:** tokens follow `prefers-color-scheme` unless `<html data-theme>` says otherwise. `ThemeSwitch` in the header sets it and saves the choice (`swgr-theme`; "auto" removes both). An inline script in `BaseLayout` applies the saved theme before first paint, so there's no flash.
- Svelte components use runes (`$props`, `$state`, `$derived`) and typed `Props` interfaces. Variants are union-typed props mapped to RSCSS `-variant` classes (see `Tag.svelte`).

## Components

Showcased at `/components` under `npm run dev`. Every new component, and every new variant, gets a specimen in `src/dev/Showcase.svelte`, fed with real game data.

| Group | Components |
|---|---|
| Basics | `Button` (default, primary, quiet; small), `ModeSwitch` (generic pill group), `Tag`, `GameIcon` (tints white glyphs, shows colour art as-is), `KeywordText` (the game's gold keywords), `InfoTip` (native popover), `ThemeSwitch` (in the site header) |
| Overview | `StatRow` + `StatPips`, `SpeedPanel`, `StylePanel`, `AbilitySlot`, `PartRow` |
| Pickers | `Drawer` (native modal `<dialog>`; bottom sheet on phones), `PartCard`, `RarityToggle`, `ChoiceCard`, `SearchField` |
| Readout | `SituationalEffect` (on/off or a 0–50 trigger count), `ChangeRow` (renders a `RowView` from `src/lib/format`) |
| Layout | `Panel` (a titled overview panel with a count and actions), `FavourRow` |
| Pages | `BuildPlanner/` (the planner island, its pickers and the screenshot import), `PlannerNotes.astro` |

- **Logic in `src/lib`, not components.** Formatting and anything else testable without a DOM belongs in `src/lib/format` (or `lib/engine`). Components take the result as props.
- **Native platform features over hand-rolled ones.** `Drawer` uses `<dialog>.showModal()`, which gives focus trapping, Escape to close, an inert page behind and focus returned to the opener. `InfoTip` uses the popover API (top layer, light dismiss). jsdom has neither, so test those in `tests/e2e/showcase.spec.ts`.
- **Handlers on Svelte components need explicit parameter types** (`(n: number) => …`). ESLint can't infer them through component props and reports `any`.
- **Shared Sass from a component** uses a relative path: `@use '../../styles/breakpoints' as bp;`. `svelte-check` compiles styles without Vite's `~/` alias.
- **`svelte-ignore` comments hold only the warning codes.** Put the reason in a separate comment above it; the linter reads any extra words as codes.

## Build planner

`src/pages/index.astro` mounts `BuildPlanner` (`client:load`). The island only holds the build and wires components together; every rule is a pure function in `src/lib/planner/actions.ts`, tested in `planner.test.ts`. Behaviour to keep:
- **Picking:** the drawer closes after every pick, and focus returns to what opened it.
- **Rarity:**
  - One rarity per part family: an owned family's card shows "In build".
  - Changing an installed part's rarity moves its situational counts to the new part.
- **Style changes:**
  - A new style replaces the old style's starting abilities and keeps other abilities.
  - Campaign keeps the current rank.
- **Mode switches** keep the same-named style, drop parts the mode doesn't allow, and drop favours when leaving Campaign.
- **Start-up:**
  - A `#gr2-…` link wins.
  - Otherwise the last build is restored from `localStorage` (`swgr-build`, the legacy key), validated by `restoreBuild`.
- **Stale links:** once the build stops matching the link it was opened from, the hash is removed, so a reload keeps the user's edits.
- **Copy build link** writes the hash and copies the URL. If the clipboard is blocked, the code is left in the box to copy by hand.
- **Readout:** "What changes" always lists the Afterburner and Ramjet top-speed bonuses (`PINNED` in `readout.ts`).
- **Screenshot import** ([ADR 0016](docs/adr/0016-screenshot-import.md)): paste (anywhere on the planner), drop, or "Import screenshot" opens a review drawer; nothing applies until "Use this build".
  - Recognition is `src/lib/import/` (OCR text matched to game names, pips counted, part rarity from the dots under the icon). The OCR engine is injected.
  - Browser glue is `BuildPlanner/screenshot.ts`, loaded only when an image arrives. tesseract.js and its English data are self-hosted; the `ocr-data` integration serves the data at `/ocr/4.0.0_best_int/`.
  - Fixtures are real captures in `src/lib/import/fixtures/`. After a game UI change, add a capture and update the reference coordinates.
- **Testing:** `tests/e2e/planner.spec.ts` covers these against the production build, including a real legacy link and the live planner's numbers. The stat rows' `<output>` levels are ARIA status regions too, so the toolbar message is addressed by its class in tests.

## Tour simulator

`src/pages/tour.astro` mounts the `TourSimulator` island and the static `TourNotes`. All game rules live in `src/lib/tour/`; the island only holds state.

- **Reducer:** `tourAction(data, state, action)` returns `{ state, message? }` and never mutates its input. `TourState` is plain JSON, so it saves as is. In Svelte, pass `$state.snapshot(tour)`, not the proxy: the reducer `structuredClone`s its input, which fails on a proxy.
- **Randomness:** `createRng` is the legacy mulberry32, re-seeded from `seed + rolls * 7919` for every roll. The same seed and actions always replay the same run (`replay`), and the unit tests rely on this.
- **Parts:** one rarity per family (ADR 0009). Offers never include a lower or the same rarity of an owned family. A higher rarity replaces the owned part in its slot, even when the part slots are full.
- **Fit labels:** `rateOffers` scores offers with `createSynergy`. The top offer is "Best fit"; others within 80% of it are "Good fit".
- **Start-up:** the last run is restored from `localStorage` (`swgr-tour-v2`, `{ version: 1, state }`) through `restoreTour`, which rejects unknown ids. Otherwise a new run starts with a random seed.
- **Layout:** the tour track and the current phase (`TourStage`) on the left; racer, owned abilities and parts, standings and the run log on the right. "Open this build in the planner" links the current build as a build code.
- **Testing:** `src/lib/tour/tour.test.ts` plays whole runs and checks the rules; `tests/e2e/tour.spec.ts` plays races through the shop on desktop and phone.

## Engine rules

- **`src/lib/` is framework-free** (ADR 0008). ESLint rejects Svelte or Astro imports and DOM globals there.
- **Game maths must not drift from the legacy planner** until it is deliberately changed. `src/lib/engine/parity.test.ts` compares against `tests/legacy/`. If you change the maths on purpose, update the legacy reference copy in the same change and record why in an ADR. Never edit `tests/legacy/` for any other reason, and delete it when the legacy site is retired.
- **Build codes:** always encode and decode through `encodeBuild` / `decodeBuild`, never by hand.

## Toolchain notes

- **TypeScript is pinned to 6.0.** TypeScript 7 is out, but `@astrojs/check`, `svelte-check`, `@astrojs/svelte` and `typescript-eslint` support only up to 6.0. Upgrade when they do.
- **No `eslint-plugin-jsx-a11y`:** it doesn't support ESLint 10 yet. Svelte's compiler a11y warnings still run, and `svelte-check` fails on them.
- **Linting `.astro` files:** the type-aware `no-unsafe-*` rules are off there, because the Astro parser can't type template expressions. `astro check` covers those files instead.
- **Preview servers:** the Claude app's browser preview may start a stale server from an old session folder. If so, run `npm run dev` in a terminal and open http://localhost:4321.
