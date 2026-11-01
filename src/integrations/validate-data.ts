import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { validateCommittedData } from '../lib/data/validate.ts';

/** Refuses to start the dev server or a build when the committed game data is invalid (ADR 0007). */
export default function validateData(): AstroIntegration {
  return {
    name: 'galactic-racer:validate-data',
    hooks: {
      'astro:config:setup': ({ config, logger }) => {
        const problems = validateCommittedData(fileURLToPath(config.root));
        if (problems.length) {
          throw new Error(`Game data in src/data is invalid:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
        }
        logger.info('game data valid');
      },
    },
  };
}
