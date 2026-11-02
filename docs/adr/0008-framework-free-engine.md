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

## Implementation (2026-11-01)

- **`src/lib/engine/`**
  - `ops.ts`: tune operations, cells, the combine formula.
  - `evaluate.ts`: `collect` and `evaluate`, including the Speed-proc Power bonus.
  - `build.ts`: the `Build` type, `freshBuild`, mode filters.
  - `codes.ts`: `encodeBuild` and `decodeBuild`, which index through `build-order.json` (ADR 0010).
  - `speeds.ts`: top speed and boost bonuses for the readout.
- **`src/lib/synergy/synergy.ts`:** the recommender (`createSynergy`).
- **Proving parity:** the legacy `engine.js` and `synergy.js` are kept verbatim in `tests/legacy/` as reference implementations. `parity.test.ts` runs both side by side and requires identical results on:
  - every part, ability, favour and racer style, on every vehicle, plain and with every situational effect counted
  - every slot at every level
  - an everything-at-once build
  - synergy tags, scores, focus and upgrade advice for every style

  A deliberate 0.1% change to the combine formula fails 16 of those tests, so they do detect drift.
- **Retiring the reference copies:** delete `tests/legacy/` together with the legacy site. After that the explicit tests carry the regression baseline:
  - the legacy `test-engine.js` cases
  - real shared links
  - the live planner's top speeds
- **Enforcement:** ESLint fails any import of `svelte`, `astro` or `astro:*`, and any use of DOM globals, under `src/lib/`.
- **Tour simulation: ported in its own PR (2026-11-01).** `src/lib/tour/` holds it:
  - `tourAction(data, state, action)` is a pure reducer over plain-JSON state, replacing the legacy page's UI-state machine.
  - Randomness comes from the legacy mulberry32 RNG, seeded per roll, so a seed plus the actions replays a run exactly.
  - The part-family rule (ADR 0009) is enforced and tested.

## Consequences

- UI rewrites can't change game maths without failing a test.
- The engine can be reused in per-item static pages at build time, for example "this part's effect at each rarity" (ADR 0003).
- Mechanics are modelled in one place, so ADR 0009 maps directly onto code.
