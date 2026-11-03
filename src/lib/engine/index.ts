// Framework-free build engine (ADR 0008): no Svelte, Astro or DOM imports anywhere under src/lib/engine.
export { freshBuild, partAllowed, abilityAllowed, isCrashAbility, fitAbilities, stylesFor, MAX_LEVEL, type Build, type ActiveCount } from './build.ts';
export { evaluate, collect, type Evaluation, type Row, type CellResult, type Conditional, type SourcedOp } from './evaluate.ts';
export { encodeBuild, decodeBuild, BuildCodeError, NO_STYLE } from './codes.ts';
export { speeds, toKmh, KMH_PER_MPH, type Speeds } from './speeds.ts';
export { parseOp, contributions, combine, cellBase, isModifier, type Modifier, type CellValue, type Contribution } from './ops.ts';
