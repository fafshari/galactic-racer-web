/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';
import { svelteTesting } from '@testing-library/svelte/vite';

// Uses Astro's Vite setup (Svelte plugin, aliases) so tests see the same build as the site (ADR 0013).
export default getViteConfig({
  plugins: [svelteTesting()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
