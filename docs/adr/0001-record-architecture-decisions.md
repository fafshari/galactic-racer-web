# 0001. Record architecture decisions

- Status: Accepted
- Date: 2026-11-01

## Context

The planner grew quickly through many small requests. The reasons behind its shape were never written down: why it's one file per page, why some values say "of default", why build codes look the way they do. Those reasons lived only in chat history. The site is now moving to a new stack, and the people and agents working on it need the reasons as well as the results.

The project also mixes two kinds of "decisions":
- engineering choices we control
- models of game behaviour that we can only infer from data, because the compiled game code holds the truth

## Decision

- Keep one short ADR per decision in `docs/adr/`, using the template in [the index](README.md).
- Use the status **Assumed** for inferred game behaviour, so it's never mistaken for fact.
- `CLAUDE.md` summarises the current rules and links here for the reasons.

## Consequences

- A change that contradicts an ADR needs a new ADR that supersedes it.
- `CLAUDE.md` has to be kept in step with accepted ADRs.
- When new evidence (an in-game measurement, a code finding) overturns an Assumed ADR, record it as a superseding ADR, not a silent edit.
