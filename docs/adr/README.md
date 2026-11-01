# Architecture decision records

Each file records one decision: the context, what we chose, and what follows from it. Decisions are never edited away. When one changes, write a new ADR that supersedes it and update the old one's status.

## Statuses

- **Accepted**: decided; build to it.
- **Assumed**: the best model we have of something we can't observe directly (usually game behaviour hidden in compiled code). Build to it, but expect evidence to overturn it.
- **Open**: needs a decision or evidence; the ADR lists what's missing.
- **Superseded by NNNN**: replaced; kept for history.

## Index

| # | Decision | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-separate-datamine-and-web.md) | Keep the datamine and the web project separate | Accepted |
| [0003](0003-astro-static-site.md) | Astro as a static site | Accepted |
| [0004](0004-svelte-islands.md) | Svelte for interactive islands | Accepted |
| [0005](0005-scoped-scss-with-rscss.md) | Scoped SCSS with RSCSS naming, no CSS Modules | Accepted |
| [0006](0006-component-library.md) | In-repo component library with a /components page | Accepted |
| [0007](0007-typescript-strict.md) | TypeScript in strict mode | Accepted |
| [0008](0008-framework-free-engine.md) | Framework-free engine in `src/lib` | Accepted |
| [0009](0009-game-mechanics-model.md) | Game-mechanics model | Assumed |
| [0010](0010-build-codes.md) | Build codes are a public contract | Accepted (stable ordering Open) |
| [0011](0011-vercel-hosting.md) | Host on Vercel; redirect the old GitHub Pages site | Accepted |
| [0012](0012-build-overview-ux.md) | Build overview with slide-over drawer pickers | Accepted |
| [0013](0013-testing.md) | Vitest and Playwright | Accepted |
| [0014](0014-data-and-asset-delivery.md) | Data and icons as separate cached files | Accepted |
| [0015](0015-publishing-and-legal-constraints.md) | Publishing and legal constraints | Accepted |

## Template

```markdown
# NNNN. Title

- Status: Accepted | Assumed | Open | Superseded by NNNN
- Date: YYYY-MM-DD

## Context
What forces are at play, and why a decision is needed.

## Decision
What we do.

## Consequences
What becomes easier, harder, or required because of it.

## Open questions
Only if something is unresolved.
```
