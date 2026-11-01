# 0008. Framework-free engine in `src/lib`

- Status: Accepted
- Date: 2026-11-01

## Context

Three pieces of logic don't depend on any UI:
- `engine.js`: build → tune operations → tuned values
- `synergy.js`: scores tour offers against a build
- the build-code encoder and decoder

The planner and tour simulator both use them, and so does Node (`test-engine.js`). Keeping this logic UI-free is what made the tests possible.

## Decision

- **Location:** port the engine, synergy scoring and build codes to TypeScript modules under `src/lib/`, with no imports from Svelte, Astro or the DOM.
- **Pure functions:** `evaluate(data, build)` returns rows, conditionals, power and power bonus. Svelte components derive their view from that result.
- **Tour simulation** (shop odds, rerolls, field simulation) also moves into `src/lib/` as pure functions, with randomness from an injected seeded RNG so runs can be reproduced in tests.
- **Tests:** each module has Vitest tests (ADR 0013). The legacy tests and checks are the starting point, ported first, before any behaviour changes:
  - `test-engine.js`
  - `check-synergy.js`
  - `check-offer.js`
  - `coverage-check.js`

## Consequences

- UI rewrites can't change game maths without failing a test.
- The engine can be reused in per-item static pages at build time, for example "this part's effect at each rarity" (ADR 0003).
- Mechanics are modelled in one place, so ADR 0009 maps directly onto code.
