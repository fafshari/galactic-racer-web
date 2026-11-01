# 0007. TypeScript in strict mode

- Status: Accepted
- Date: 2026-11-01

## Context

The legacy code is untyped JavaScript working on a large, irregular JSON file:
- configs keyed by game struct names
- tune operations with optional vectors and curves
- rules with nested requirements and effects

Bugs so far have mostly been shape bugs:
- a missing section in a build code
- a base value that's sometimes a number, sometimes an `{add, mult, mul}` object, sometimes a curve
- an effect with no tunesets

The user wants type safety enforced and typing best practice followed.

## Decision

- **Strictness:** TypeScript everywhere (`.ts`, `<script lang="ts">` in `.astro` and `.svelte`). Extend Astro's `strictest` tsconfig preset, which includes:
  - `strict`
  - `noUncheckedIndexedAccess`
  - `exactOptionalPropertyTypes`
  - `noImplicitOverride`
  - `noFallthroughCasesInSwitch`
  - `noImplicitReturns`
  - `useUnknownInCatchVariables`
- **Enforcement:** `astro check` and `svelte-check` run in CI and fail the build on any error. ESLint with `typescript-eslint` (strict, type-checked rules) also runs in CI.
- **Data typing:**
  - One module (`src/lib/data/types.ts`) describes `planner.json`.
  - The data is validated once at the boundary (on import and on load) with a schema library (Zod or Valibot), and its types are derived from the schema.
  - Code past the boundary trusts the types.
- **Practices:**
  - No `any`: use `unknown` and narrow.
  - No `!` non-null assertions without a comment.
  - No `as` casts except at validated boundaries.
  - Discriminated unions for values with several shapes (scalar / vector / curve; known / unknown base).
  - `satisfies` for typed constants.
  - `readonly` for data from the game.
- **Branded ids:** ids that must not be mixed up (`PartId`, `AbilityId`, `StyleId`, `VehicleId`) are branded string types.

## Consequences

- The engine port is the first test of the types. Ambiguous shapes in `planner.json` get fixed at the source (the datamine build) rather than worked around.
- Slightly more ceremony when adding fields to the data. That's intended, since the data contract is shared between two projects (ADR 0002).
