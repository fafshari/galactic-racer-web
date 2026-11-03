# 0019. Arcade vehicles page

- Status: Accepted
- Date: 2026-11-02

## Context

The game's Arcade mode gives the player a pre-made vehicle for each event, with a set of parts and abilities but no racer style. Players want to load these into the planner and compare them. The datamine has them:
- `DA_ArcadeDef`: the events in the game's order
- each event's definition: its name, tab, planet and track, lap count, card colour, lock text and unlock chain
- the event's vehicle build: levels, parts and abilities
- its leaderboard: three authored times, which are the gold, silver and bronze medal times

## Decision

- **Export:** `build_planner_data.py` adds an `arcade` list to `planner.json` (schema `ArcadeEvent`, strict). Each event's `lockedBy` points at the Arcade event that unlocks it, or is null when something outside Arcade unlocks it. References are checked like every other id.
- **No racer style:** Arcade builds open with `style: null` (build-code style digits `zz`, ADR 0010).
- **Mode:** an event's build opens in Campaign wherever Campaign has the vehicle, and in Multiplayer Tour for Podracers. Arcade builds sit with the Campaign builds in the game files, and 14 carry Faulty parts, which the planner only allows in Campaign.
- **Builds are loaded as the game has them**, even where they break planner rules: several parts of one family, or more than one Faulty part.
- **Not modelled:**
  - the plane-only special part on Podracer builds
  - the event-authored stats on two Podracer events (`authoredStats`, flagged on the card)
  - the missing Ramjet (`ramjet: false`, shown as "None")
- **Page:** `/arcade.html` (static Astro, no island) shows one horizontally scrolling row of `ArcadeCard`s per Arcade tab, after the game's Arcade screen:
  - each card shows the planet, track, medal times, event type, name, lock text, level pips, speeds, kit and an "Open in the planner" link
  - tab names are ours (the game shows icons, and their names aren't in the export)
  - cards use the event's own colour instead of the game's tile art (ADR 0015)
  - player times and friend names are never shown

## Consequences

- A game patch that changes Arcade builds shows up in the `planner.json` diff on import. New events need nothing beyond `npm run import-data`, unless they add a tab, which needs a name in `CATEGORY_NAMES`.
