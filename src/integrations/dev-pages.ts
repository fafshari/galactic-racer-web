import type { AstroIntegration } from 'astro';

/**
 * Pages that exist only under `astro dev` (ADR 0006): the component showcase.
 * They live outside `src/pages`, so a production build never contains them.
 */
export default function devPages(): AstroIntegration {
  return {
    name: 'galactic-racer:dev-pages',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command !== 'dev') return;
        injectRoute({ pattern: '/components', entrypoint: new URL('../dev/components.astro', import.meta.url) });
      },
    },
  };
}
