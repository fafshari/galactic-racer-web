// Full validation of the committed data files, shared by the build-time check and the tests.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import { IconIndex, Labels, Manifest, PlannerData } from './schema.ts';
import { BuildOrder, idsOf, ORDER_CAPACITY, ORDER_KINDS } from './order.ts';
import { checkLabels, checkReferences } from './references.ts';

/** Returns every problem found in `src/data` and `src/assets/icons`; empty when all is well. */
export function validateCommittedData(root: string): string[] {
  const problems: string[] = [];
  const read = (rel: string): unknown => JSON.parse(readFileSync(join(root, rel), 'utf8'));
  const parse = <T extends z.ZodType>(rel: string, schema: T): z.output<T> | null => {
    const r = schema.safeParse(read(rel));
    if (r.success) return r.data;
    for (const i of r.error.issues.slice(0, 20)) problems.push(`${rel} ${i.path.map(String).join('.')}: ${i.message}`);
    return null;
  };

  const planner = parse('src/data/planner.json', PlannerData);
  const icons = parse('src/data/icons.json', IconIndex);
  const labels = parse('src/data/labels.json', Labels);
  const order = parse('src/data/build-order.json', BuildOrder);
  parse('src/data/manifest.json', Manifest);
  if (!planner || !icons || !labels || !order) return problems;

  problems.push(...checkReferences(planner, icons), ...checkLabels(planner, labels));
  for (const name of Object.keys(icons)) {
    if (!existsSync(join(root, 'src', 'assets', 'icons', `${name}.webp`))) problems.push(`icon file missing: ${name}.webp`);
  }
  // Every exported id must have a permanent build-code position, within the format's capacity.
  const current = idsOf(planner);
  for (const kind of ORDER_KINDS) {
    const positions = new Set(order[kind]);
    for (const id of current[kind]) if (!positions.has(id)) problems.push(`build-order.json ${kind}: no position for "${id}" (run npm run import-data)`);
    if (order[kind].length > ORDER_CAPACITY[kind]) problems.push(`build-order.json ${kind}: over capacity`);
  }
  return problems;
}
