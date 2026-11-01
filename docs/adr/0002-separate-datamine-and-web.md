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

## Open questions

- Should the data export include a manifest (game build number, export date, usmap name), so the site can show which game build its numbers come from? Recommended: yes.
