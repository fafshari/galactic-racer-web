# 0010. Build codes are a public contract

- Status: Accepted (stable ordering is Open)
- Date: 2026-11-01

## Context

Users share builds as links like `https://…/#gr2-m106475806.….….…`. Those links live in chats and posts we can't update, so the format is a public contract. One bug has already happened: chat apps strip trailing dots, which broke links for builds with no parts.

## Decision

- **Format** (version 2, stored in the URL hash): `gr2-{m|c}{vehicle}{style as 2 base-36 digits}{6 slot levels}.{parts}.{abilities}.{favours}`.
  - `m` / `c`: Multiplayer Tour / Campaign.
  - The parts, abilities and favours sections each hold 2-character base-36 indexes into the data arrays.
- **Encoding:** the encoder strips trailing dots, and the decoder accepts missing trailing sections.
- **Index order:** indexes refer to positions in the exported data. The data export must keep array order stable across game patches. New items go at the end, and removed items leave a placeholder, so old codes keep pointing at the same things.
- **Format changes:** any incompatible change gets a new prefix (`gr3-`). Decoders for every older prefix stay in the code, with tests using real saved links.
- **Saved state:** the last build is also kept in `localStorage` under `swgr-build`. Keep that key, or migrate it, so returning users keep their build.

## Consequences

- The data export has an ordering constraint (ADR 0002) that the Python build must respect.
- Index stability across game patches isn't guaranteed today. The current export sorts parts and abilities alphabetically by asset name, so a part added in a patch shifts the index of every part after it, and old links would load different parts. Making the order stable is a follow-up in the datamine, and it has to land before the first post-patch data import.
- Build-code tests must include links in their real, shared form, including ones with dots stripped.

## Open questions

- Stable ordering: do we store a persistent id-to-index map in the datamine, or switch codes to short hashes of game ids in `gr3`? Recommended: a persistent map, which keeps the format unchanged.
