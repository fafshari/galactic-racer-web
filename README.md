# Galactic Racer Planner

A fan-made build planner and Multiplayer Tour simulator for STAR WARS: Galactic Racer, built from values datamined from the game files.

**Site:** https://galactic-racer-planner.vercel.app

Free, no ads, no accounts. Not affiliated with or endorsed by Lucasfilm, Disney or the game's developers.

## Running it locally

Needs Node 22.23.4 or newer.

```bash
npm install
npm run dev      # http://localhost:4321
npm run verify   # type checks, lint, unit and browser tests
```

## Contributing

Bug reports and pull requests are welcome. Every change is reviewed before it's merged.

What changed in each version is in the [changelog](CHANGELOG.md). A pull request that changes the site bumps the version and adds a changelog entry; [ADR 0018](docs/adr/0018-versioning-and-changelog.md) explains how to choose the bump.

## License

The code is [MIT licensed](LICENSE). The license covers this project's own code only. The game data in `src/data/` (except `labels.json` and `build-order.json`) and the images in `src/assets/icons/` are taken from STAR WARS: Galactic Racer, belong to their respective owners and aren't covered by the license.
