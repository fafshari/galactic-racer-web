# 0015. Publishing and legal constraints

- Status: Accepted
- Date: 2026-11-01

## Context

The site is built from datamined game content (numbers, text, icons and art) for a commercial game owned by Lucasfilm / Electronic Arts. Publishing it is fan use, and some things must never be published.

## Decision

- **Never publish:**
  - game files, raw dumps, mappings (`.usmap`)
  - the extractor or probe tools
  - anything from `swgr-datamine` other than the exported planner data and images (ADR 0002)
- **Read files only.** Data comes from reading game files on disk. No injection into, or modification of, the running game.
- **Publish under the project's `fafshari` GitHub account only**, committing with that account's GitHub noreply address.
- **Licensing:** the code is MIT licensed; the game content is not ours to license (ADR 0017).
- **Fan notice:** every page carries the fan-made notice ("not affiliated with or endorsed by Lucasfilm, Electronic Arts or the game's developers; all names, text and icons belong to their owners").
- **Non-commercial:** no ads, paid features or monetisation. This also keeps the site within Vercel's Hobby terms (ADR 0011).
- **Deploys and pushes happen only on the user's explicit request.**

## Consequences

- Repo checks guard against accidents: `.gitignore` excludes game file types, and the CLAUDE.md rules spell this out.
- A takedown request from the rights holders would be honoured by taking the site down; nothing in the architecture depends on keeping it up.
