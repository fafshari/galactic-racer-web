# 0018. Version the site and keep a changelog

- Status: Accepted
- Date: 2026-11-02

## Context

The repo is public (ADR 0017) and players share the site. They need a way to see what changed and when, and contributors need to know how to describe their change. `package.json` still said `0.0.0`.

What's particular to this site:
- Vercel deploys every merge to `main` (ADR 0011), so every merge is a release.
- Its public contracts aren't an API:
  - build-code links (ADR 0010)
  - builds, favourites and tour runs saved in the visitor's browser
  - the page URLs
- Game patches change the numbers without any change to our code.

## Decision

**Semantic versioning, adapted to a website.** The version is in `package.json`. Classify each change by the highest row that applies:

| Bump | When the change… | Examples |
|---|---|---|
| **Major** | breaks a public contract | an old build link no longer loads or loads a different build; saved builds, favourites or tour runs are lost; a page is removed without a redirect |
| **Minor** | adds something a visitor can use, or adds game content | a new page, panel, picker or readout; a new setting; a game-data re-import after a patch that adds vehicles, parts, abilities or other ids |
| **Patch** | corrects what's already there | a bug fix; a data or label correction; wording, tips, styling or layout fixes; performance; a re-import with no new ids |
| **None** | doesn't change the deployed site | docs, ADRs, tests, CI, tooling, refactors with no visible effect, the dev-only `/components` showcase |

- A build-code format change that keeps old links loading (a new prefix plus a decoder for the old one, as ADR 0010 requires) is minor, not major.
- A deliberate change to the game maths (ADR 0009) is minor if it adds a mechanic, patch if it corrects one.
- Dependency upgrades are none, unless they change something visible; then classify by that.

**Changelog:** `CHANGELOG.md` at the repo root, in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) style.
- One `## [X.Y.Z] - YYYY-MM-DD` section per version, newest first, with `Added`, `Changed`, `Fixed` and `Removed` groups as needed.
- Entries are written for players: what they'll notice, not which files moved. Link the pull request.
- Changes with no bump get no entry.

**Cadence: bump in each pull request.**
- A PR that changes the deployed site bumps `package.json` (and the lockfile's copy) and adds its section to `CHANGELOG.md`, dated the day it's opened. Update the date if it merges on a later day.
- If two open PRs claim the same version, the one merged second takes the next number when it's brought up to date.
- After a merge, `main` is tagged `vX.Y.Z` when the owner asks for a push. Tags are what the changelog's version links point to.

**Baseline:** `main` as of PR #21 (Advanced upgrade effects) is **1.0.0**. Everything before it is summarised in that one entry. PR #22 (readout colours by improvement), PR #23 (this versioning) and PR #24 (the footer version and the "What's new" page) make up **1.0.1**. The page is minor by the table above, but the owner chose to keep it in 1.0.1 as the last piece of the versioning work.

**Where the version shows:**
- A **"What's new" page** (`/changelog.html`, in the site's navigation) shows `CHANGELOG.md` to players, so they don't need GitHub. It's built from the file at build time by `src/lib/changelog.ts`, which understands only what the changelog uses: release headings, `###` groups, one-line `- ` items, plain paragraphs before the first group, and inline links, `code` and **bold**. Anything else fails the unit tests rather than showing up broken.
- The site footer shows `vX.Y.Z`, read from `package.json`, linked to that page.
- A unit test (`src/lib/version.test.ts`) fails when `package.json`, the lockfile and the newest `CHANGELOG.md` heading disagree. CI runs it with `npm test`.

**Triage:** every change is classified with the table above before its PR is opened, and the bump is proposed to the owner. `CLAUDE.md` tells agent sessions to do this.

## Consequences

- Visitors can match what they see to a version and read what changed.
- Every PR touching the site carries a version bump, so parallel PRs can collide on the number; the second to merge renumbers.
- The version check fails CI if a bump or a changelog entry is forgotten on one side.
- Game patches leave a trace in the changelog even though they're data-only.
- The ADR 0011 redirect of the old GitHub Pages site doesn't change the deployed site, so it needs no bump.
