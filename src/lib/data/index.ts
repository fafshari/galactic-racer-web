// The one place the site reads game data (ADR 0007, 0014).
//
// The committed JSON is validated by `npm run import-data`, by `npm test` and when every dev server or build starts
// (src/integrations/validate-data.ts), so code here trusts it instead of parsing a megabyte of JSON in the browser.
// These casts are that validated boundary; nothing past this module touches raw JSON.
import plannerJson from '../../data/planner.json';
import iconsJson from '../../data/icons.json';
import labelsJson from '../../data/labels.json';
import orderJson from '../../data/build-order.json';
import manifestJson from '../../data/manifest.json';
import type { BuildOrder } from './order.ts';
import type { IconIndex, IconName, Labels, Manifest, PlannerData } from './types.ts';

export const planner = plannerJson as unknown as PlannerData;
export const icons = iconsJson as unknown as IconIndex;
export const labels = labelsJson as unknown as Labels;
export const buildOrder = orderJson as unknown as Readonly<BuildOrder>;
export const manifest = manifestJson as unknown as Manifest;

// Vite emits each icon as its own hashed, long-cached file; this maps icon names to those URLs.
const iconFiles = import.meta.glob<string>('../../assets/icons/*.webp', { eager: true, query: '?url', import: 'default' });
const iconUrls = new Map<string, string>(
  Object.entries(iconFiles).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.webp'.length), url]),
);

/** URL of an exported game icon, or undefined if the export has none by that name. */
export function iconUrl(name: IconName): string | undefined {
  return iconUrls.get(name);
}

/** White glyph icons are tinted with the theme (CSS mask); full-colour art is shown as-is. */
export function isGlyph(name: IconName): boolean {
  return icons[name]?.glyph ?? false;
}
