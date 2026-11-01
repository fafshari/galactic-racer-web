import { defineConfig, fontProviders } from 'astro/config';
import svelte from '@astrojs/svelte';
import devPages from './src/integrations/dev-pages';

// Static site (ADR 0003). `build.format: 'file'` keeps the legacy URLs: / , /index.html and /tour.html.
export default defineConfig({
  output: 'static',
  build: { format: 'file' },
  integrations: [svelte(), devPages()],
  // Self-hosted at build time from Google Fonts; exposed as CSS variables used by the design tokens.
  fonts: [
    { provider: fontProviders.google(), name: 'Unbounded', cssVariable: '--font-unbounded', weights: ['600', '700', '800', '900'], fallbacks: ['sans-serif'] },
    { provider: fontProviders.google(), name: 'Barlow', cssVariable: '--font-barlow', weights: ['400', '500', '600'], styles: ['normal', 'italic'], fallbacks: ['sans-serif'] },
    { provider: fontProviders.google(), name: 'Barlow Semi Condensed', cssVariable: '--font-barlow-semi', weights: ['500', '600', '700'], styles: ['normal', 'italic'], fallbacks: ['sans-serif'] },
    { provider: fontProviders.google(), name: 'IBM Plex Mono', cssVariable: '--font-plex-mono', weights: ['400', '500'], fallbacks: ['monospace'] },
  ],
});
