# 0010. Build codes are a public contract

- Status: Accepted
- Date: 2026-11-01

## Context

Users share builds as links like `https://…/#gr2-m106475806.….….…`. Those links live in chats and posts we can't update, so the format is a public contract. One bug has already happened: chat apps strip trailing dots, which broke links for builds with no parts.

## Decision

- **Format** (version 2, stored in the URL hash): `gr2-{m|c}{vehicle}{style as 2 base-36 digits}{6 slot levels}.{parts}.{abilities}.{favours}`.
  - `m` / `c`: Multiplayer Tour / Campaign.
  - The parts, abilities and favours sections each hold 2-character base-36 indexes into the data arrays.
  - Abilities: up to four regular ones, then the crash ability (ADR 0009). The list needs no marker, since an ability's kind comes from the data. A code with a crash ability among the first four (made before the crash slot existed) still decodes; the crash ability moves to its slot.
- **Encoding:** the encoder strips trailing dots, and the decoder accepts missing trailing sections.
- **Index order:** indexes refer to positions in the exported data. The data export must keep array order stable across game patches. New items go at the end, and removed items leave a placeholder, so old codes keep pointing at the same things.
- **Format changes:** any incompatible change gets a new prefix (`gr3-`). Decoders for every older prefix stay in the code, with tests using real saved links.
- **Saved state:** the last build is also kept in `localStorage` under `swgr-build`. Keep that key, or migrate it, so returning users keep their build.

## Consequences

- The data export has an ordering constraint (ADR 0002) that the Python build must respect.
- Build-code tests must include links in their real, shared form, including ones with dots stripped.

## Stable ordering (resolved 2026-11-01)

The export sorts parts and abilities alphabetically by asset name, so a part added in a patch would shift every later index and old links would load different parts. Positions therefore don't come from the export order. They come from **`src/data/build-order.json`**, which lives in this repo so it's version controlled:
- It holds the permanent position of every vehicle, upgrade slot, style, part, ability and favour id ever exported.
- `npm run import-data` extends it and never reorders it (`mergeOrder` in `src/lib/data/order.ts`):
  - **existing ids** keep their position
  - **new ids** are appended
  - **ids the game drops** stay as retired entries, so later positions don't move
- The import refuses to run if:
  - a list would exceed what a `gr2` code can address (10 vehicles; 1,296 styles, parts, abilities or favours)
  - the six upgrade slots change
- It was created from the export order on the first import, and a check confirmed it matches the live legacy site exactly. So every link shared before the migration decodes the same.
- The build-code encoder and decoder (engine port, ADR 0008) must index through this file, never through the data arrays.

This keeps the `gr2` format unchanged; switching to hashed ids in a `gr3` format wasn't needed.
