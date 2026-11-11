# Changelog

What changed on the [Galactic Racer Planner](https://galactic-racer-planner.vercel.app), newest first.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [semantic versioning adapted to this site](docs/adr/0018-versioning-and-changelog.md):
- **major** when an old build link or saved build stops working
- **minor** for new features and new game content
- **patch** for fixes and corrections

## [1.1.3] - 2026-11-11

### Fixed

- Tour simulator: a bought Upgrade Pack raises a stat by 1. It used to add the race-reward upgrade size you set under "Assumptions".

## [1.1.2] - 2026-11-11

### Fixed

- Tour simulator: the backer you pick at the first race now stays with you for the whole tour, offering three of its own contracts at every later race, as in the game. ([#27](https://github.com/fafshari/galactic-racer-web/pull/27))

## [1.1.1] - 2026-11-02

### Fixed

- Importing a screenshot reads your abilities again when your racer style has fewer than four traits, and now reads the crash ability too. ([#26](https://github.com/fafshari/galactic-racer-web/pull/26))
- Importing a screenshot reads the top speed reliably, instead of sometimes dropping a digit. ([#26](https://github.com/fafshari/galactic-racer-web/pull/26))
- Arcade cards in a row have headers of the same height, so medal times and names line up. ([#26](https://github.com/fafshari/galactic-racer-web/pull/26))

## [1.1.0] - 2026-11-02

### Added

- An **Arcade** page: every Arcade event's pre-made vehicle, row by row as in the game, with planet, track, gold, silver and bronze times, what unlocks it, and the vehicle's levels, speeds, parts and abilities. Each one opens in the planner. ([#25](https://github.com/fafshari/galactic-racer-web/pull/25))
- "No racer style" in the planner's style picker, for copying Arcade vehicles, which have none. Clearing the style drops its starting abilities and keeps your levels, parts and other abilities. Builds without a style save, share as links and go in favourites like any other. ([#25](https://github.com/fafshari/galactic-racer-web/pull/25))

## [1.0.1] - 2026-11-02

### Added

- This "What's new" page, and the site's version in the footer. ([#24](https://github.com/fafshari/galactic-racer-web/pull/24))

### Fixed

- "What changes" colours a change green when it's an improvement and red when it's worse, instead of by whether the number went up. Lower-is-better values, such as acceleration lost while knifing, no longer show as penalties. ([#22](https://github.com/fafshari/galactic-racer-web/pull/22))
- Changes to a value whose base is unknown read "73% less than default" or "20% more than default", instead of a percentage that looked like the result. ([#22](https://github.com/fafshari/galactic-racer-web/pull/22))
- Corrected labels and tips for Resilience's "hits to become Vulnerable", drift sideways speed and knifing steering rate. ([#22](https://github.com/fafshari/galactic-racer-web/pull/22))

## [1.0.0] - 2026-11-02

First versioned release: the site rebuilt on Astro and Svelte and moved to Vercel, replacing the original GitHub Pages planner.

### Build planner

- A build overview modelled on the game's build screen: vehicle stats with pips and top speed, racer style and its traits, four ability slots plus the crash-ability slot, installed parts and, in Campaign, favours.
- Multiplayer Tour and Campaign modes.
- Slide-over pickers for vehicles, styles, abilities and parts, with search and rarity choice. On phones they open as a full-screen sheet.
- One rarity per part family, as in the game.
- "What changes" readout: every tuned value before and after, top speed in km/h for Afterburner and Ramjet, ability speed boosts and reload times, and before/after charts for curves such as grip.
- Situational effects (abilities, traits, Blasts) that can be switched on or given a trigger count, with the game's own descriptions.
- Advanced upgrade effects shown for every vehicle, with tips explaining grip curves. ([#21](https://github.com/fafshari/galactic-racer-web/pull/21))
- Tips on vehicle traits, keywords and the readout's numbers.
- Import a build from a screenshot of the game's Build screen: paste, drop or pick an image, review what was recognised, then use it. Recognition runs in your browser.
- Favourites: save builds by name and reopen them, with their icons and best boost speed.
- Collapsible panels, remembered between visits.

### Build links

- Builds are shared as `#gr2-…` links. Links made with the original planner keep loading the same build.
- The last build is restored when you come back.

### Tour simulator

- Plays a Multiplayer Tour: races, standings, the shop's offers and a run log, with the same seed always replaying the same run.
- Offers are rated "Best fit" and "Good fit" for your build. Owned part families only offer higher rarities, which replace the part in its slot.
- Open the tour's current build in the planner.
- The run is saved in your browser.

### Site

- Light, dark and automatic colour themes.
- Link previews for Discord and other chat apps.
- Game data and icons datamined from the game files, with the fan-made, not-affiliated notice on every page.
- Open source under the MIT license.

[1.1.3]: https://github.com/fafshari/galactic-racer-web/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/fafshari/galactic-racer-web/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/fafshari/galactic-racer-web/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/fafshari/galactic-racer-web/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/fafshari/galactic-racer-web/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/fafshari/galactic-racer-web/releases/tag/v1.0.0
