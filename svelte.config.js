import { vitePreprocess } from '@astrojs/svelte';

// Lets Svelte components use <script lang="ts"> and <style lang="scss">.
export default {
  preprocess: vitePreprocess(),
};
