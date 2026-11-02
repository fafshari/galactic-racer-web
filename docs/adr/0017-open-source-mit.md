# 0017. Open-source the code under MIT

- Status: Accepted
- Date: 2026-11-02

## Context

The repo started private (ADR 0002, 0011). With the site live on Vercel, the planner is being shared with players. Saying it's open source and not monetised makes it clear it's a fan project, not a product.

What the user wants:
- Anyone can read, clone and fork the code and do what they like with it.
- Nobody changes the repo without the user's review.

The repo holds two kinds of content:
- our own code and hand-written data (`labels.json`, `build-order.json`)
- game data and icons exported from the game files, which belong to the rights holders (ADR 0015)

## Decision

- **Public repo** on GitHub.
- **MIT license** in `LICENSE`, kept to the standard text so GitHub detects it.
- **Scope:** the license covers our own code only. The README's License section says the game data in `src/data/` (except `labels.json` and `build-order.json`) and the icons in `src/assets/icons/` aren't covered.
- **Review stays with the owner:**
  - Only collaborators can merge, and there are none besides the owner.
  - `main` requires a pull request, with no force pushes or deletion. No approval is required, so the owner can merge their own pull requests.
- Before going public, the whole git history was checked for game files, mappings, extractor code and secrets. None were found.

## Consequences

- The ADRs, `CLAUDE.md` and the git history are public too. They mustn't hold personal details beyond what the project needs, such as local paths or other accounts.
- Contributions arrive as pull requests from forks and are reviewed like any other change.
- A takedown request covering the game content (ADR 0015) would mean removing that content from the repo and its history, not only from the site.
