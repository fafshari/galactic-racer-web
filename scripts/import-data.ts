// Imports the datamine's export into this repo (ADR 0002, 0010, 0014).
//
//   npm run import-data [-- <path to swgr-datamine>]
//
// Validates planner.json and the icon index, checks every reference and label, extends the build-code order
// (never reorders it), then writes the normalized data, the icons and a manifest. Nothing is written if any check fails.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import { IconIndex, Labels, Manifest, PlannerData } from '../src/lib/data/schema.ts';
import { checkLabels, checkReferences } from '../src/lib/data/references.ts';
import { BuildOrder, mergeOrder } from '../src/lib/data/order.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
// The datamine defaults to a sibling folder of this repo.
const datamine = process.argv[2] ?? process.env.SWGR_DATAMINE ?? join(root, '..', 'swgr-datamine');
const src = { planner: join(datamine, 'out', 'planner.json'), icons: join(datamine, 'out', 'icons'), mappings: join(datamine, 'mappings') };
const out = {
  planner: join(root, 'src', 'data', 'planner.json'),
  order: join(root, 'src', 'data', 'build-order.json'),
  labels: join(root, 'src', 'data', 'labels.json'),
  iconIndex: join(root, 'src', 'data', 'icons.json'),
  manifest: join(root, 'src', 'data', 'manifest.json'),
  icons: join(root, 'src', 'assets', 'icons'),
};

function fail(title: string, lines: readonly string[]): never {
  console.error(`\n✗ ${title}`);
  for (const l of lines.slice(0, 40)) console.error(`  - ${l}`);
  if (lines.length > 40) console.error(`  … and ${lines.length - 40} more`);
  console.error('\nNothing was written.');
  process.exit(1);
}

function parse<T extends z.ZodType>(schema: T, file: string, what: string): z.output<T> {
  if (!existsSync(file)) fail(`${what} not found`, [file]);
  const result = schema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!result.success) fail(`${what} doesn't match the schema (src/lib/data/schema.ts)`, result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`));
  return result.data;
}

function writeJson(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

// ---- read and check everything first ----------------------------------------------------------
const raw = readFileSync(src.planner);
const data = parse(PlannerData, src.planner, 'planner.json');
const icons = parse(IconIndex, join(src.icons, '_index.json'), 'icons/_index.json');
const labels = parse(Labels, out.labels, 'src/data/labels.json');

const broken = checkReferences(data, icons);
if (broken.length) fail('broken references in the export', broken);
const unlabelled = checkLabels(data, labels);
if (unlabelled.length) fail('fields without labels: add them to src/data/labels.json', unlabelled);

const existingOrder = existsSync(out.order) ? parse(BuildOrder, out.order, 'src/data/build-order.json') : null;
const merged = mergeOrder(existingOrder, data);
if (merged.errors.length) fail('build-code order problems (ADR 0010)', merged.errors);

const missingFiles = Object.keys(icons).filter((name) => !existsSync(join(src.icons, `${name}.webp`)));
if (missingFiles.length) fail('icon files listed in the index are missing', missingFiles);

// ---- write --------------------------------------------------------------------------------------
mkdirSync(out.icons, { recursive: true });
writeJson(out.planner, data);
writeJson(out.order, merged.order);
writeJson(out.iconIndex, icons);

const wanted = new Set(Object.keys(icons).map((name) => `${name}.webp`));
let removed = 0;
for (const f of readdirSync(out.icons)) {
  if (f.endsWith('.webp') && !wanted.has(f)) {
    rmSync(join(out.icons, f));
    removed++;
  }
}
for (const f of wanted) copyFileSync(join(src.icons, f), join(out.icons, f));

const usmaps = existsSync(src.mappings)
  ? readdirSync(src.mappings).filter((f) => f.endsWith('.usmap')).sort((a, b) => statSync(join(src.mappings, b)).mtimeMs - statSync(join(src.mappings, a)).mtimeMs)
  : [];
const manifest = Manifest.parse({
  game: data.meta.game,
  gameBuild: data.meta.build,
  usmap: usmaps[0] ?? null,
  plannerSha256: createHash('sha256').update(raw).digest('hex'),
  icons: wanted.size,
  importedAt: new Date().toISOString(),
});
writeJson(out.manifest, manifest);

// ---- report -------------------------------------------------------------------------------------
console.log(`✓ Imported ${data.meta.game} build ${data.meta.build}${manifest.usmap ? ` (mappings ${manifest.usmap})` : ''}`);
console.log(`  ${data.vehicles.length} vehicles, ${data.styles.length} styles, ${data.abilities.length} abilities, ${data.affixes.length} parts, ${data.favours.length} favours, ${Object.keys(data.tunesets).length} tunesets`);
console.log(`  ${wanted.size} icons${removed ? `, ${removed} stale removed` : ''}`);
if (!existingOrder) console.log('  build-code order created from the export order (matches the legacy site)');
for (const c of merged.changes) {
  if (!existingOrder) continue;
  if (c.added.length) console.log(`  ${c.kind}: ${c.added.length} new, appended: ${c.added.join(', ')}`);
  if (c.retired.length) console.log(`  ${c.kind}: ${c.retired.length} no longer exported, kept as retired: ${c.retired.join(', ')}`);
}
