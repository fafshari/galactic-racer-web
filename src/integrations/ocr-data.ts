import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/** Where the screenshot import's OCR language data is served (ADR 0016). The version keeps old caches harmless. */
export const OCR_LANG_DIR = '/ocr/4.0.0_best_int';
const FILE = 'eng.traineddata.gz';

/**
 * Serves tesseract.js's English data from this site instead of its default CDN. tesseract.js only loads language
 * data from a folder URL (`langPath`), so the file needs a fixed name rather than a hashed asset URL: it's served
 * from node_modules under `astro dev` and copied into the build output.
 */
export default function ocrData(): AstroIntegration {
  const source = (): string => join(dirname(createRequire(import.meta.url).resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int', FILE);
  return {
    name: 'galactic-racer:ocr-data',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(`${OCR_LANG_DIR}/${FILE}`, (_req, res) => {
          void readFile(source()).then((data) => {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.end(data);
          });
        });
      },
      'astro:build:done': async ({ dir }) => {
        const target = join(fileURLToPath(dir), OCR_LANG_DIR, FILE);
        await mkdir(dirname(target), { recursive: true });
        await copyFile(source(), target);
      },
    },
  };
}
