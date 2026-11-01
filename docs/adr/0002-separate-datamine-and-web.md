# 0002. Keep the datamine and the web project separate

- Status: Accepted
- Date: 2026-11-01

## Context

`C:\Users\info\swgr-datamine` holds several things:
- the extraction tooling (`SwgrDump`, a CUE4Parse extractor)
- the community mappings (`.usmap`)
- raw game dumps
- probe scripts
- the Python data build (`py/build_planner_data.py`)

The legacy site's templates and engine live there too, and a nested `site/` git repo holds only built files for GitHub Pages.

Game files, dumps, mappings and tools must never be published (ADR 0015). The user also doesn't want the datamine code version controlled. The frontend, however, needs history, review and deployment.

## Decision

- **Two projects.**
  - `swgr-datamine` stays outside version control and holds everything that touches game files.
  - `galactic-racer-web` (this repo) is a private git repo under the GitHub account `fafshari` and holds the site.
- **One-way data handoff.** The datamine exports into this repo, and nothing flows back. The export is `planner.json` plus icon images.
  - These are derived data and are already public inside the built pages, so committing them is fine.
  - An import script in this repo copies them from the datamine and validates the JSON against the TypeScript types (ADR 0007).
- **The legacy pages and engine move into this repo** as part of the migration: `planner/template.html`, `tour.html`, `engine.js`, `synergy.js`, `labels.json` and the check scripts.
- **The Python data build stays in the datamine**, because it reads game files directly.
- `CLAUDE.md` and the ADRs live here, so they're version controlled.

## Consequences

- The datamine has no history and no undo; a bad edit there is permanent. Mitigation: take a periodic zip backup of `swgr-datamine/py` and the extractor source. This is the user's call; it isn't automated.
- The `planner.json` shape becomes an interface between the two projects. Changing it means updating `src/lib/data/types.ts` and the import validation in the same change.
- Re-running the pipeline after a game patch is a two-step process: rebuild in the datamine, then import here.

## Implementation (2026-11-01)

- **`npm run import-data [-- <datamine path>]`** (`scripts/import-data.ts`) reads `out/planner.json` and `out/icons/` from the datamine.
  - It validates everything, then writes:
    - `src/data/planner.json`
    - `src/data/icons.json`
    - `src/data/build-order.json` (ADR 0010)
    - `src/data/manifest.json`
    - `src/assets/icons/*.webp`
  - It writes nothing if any check fails.
- **The manifest** records the game build, the mappings file used, a SHA-256 of the source `planner.json`, the icon count and the import time. It answers "which game build are these numbers from".
- **Labels are owned by this repo.** `src/data/labels.json` holds the hand-written field labels and headings. They were written by hand, not datamined, so they belong with the site.
  - The legacy pages still read `swgr-datamine/planner/labels.json` until they're retired; keep the two in step until then.
  - The import refuses data that has a changeable field without a label.
