<script lang="ts">
  import { onMount } from 'svelte';
  import { parseTheme, THEME_KEY, type Theme } from '~/lib/theme.ts';

  // The head script in BaseLayout applies the saved theme before first paint; this keeps it in step after that.
  let theme = $state<Theme>('auto');

  onMount(() => {
    try {
      theme = parseTheme(localStorage.getItem(THEME_KEY));
    } catch {
      // storage blocked (private mode, site data off): stay on auto
    }
  });

  function pick(t: Theme): void {
    theme = t;
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try {
      if (t === 'auto') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, t);
    } catch {
      // the choice still applies for this page view
    }
  }

  const options: readonly { value: Theme; label: string }[] = [
    { value: 'auto', label: 'Match device theme' },
    { value: 'light', label: 'Light theme' },
    { value: 'dark', label: 'Dark theme' },
  ];
</script>

<div class="theme-switch" role="group" aria-label="Colour theme">
  {#each options as o (o.value)}
    <button type="button" class="option" aria-pressed={o.value === theme} aria-label={o.label} title={o.label} onclick={() => { pick(o.value); }}>
      <svg class="icon" viewBox="0 0 20 20" aria-hidden="true">
        {#if o.value === 'auto'}
          <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" />
        {:else if o.value === 'light'}
          <circle cx="10" cy="10" r="3.6" fill="currentColor" />
          <path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        {:else}
          <path d="M16.5 12.3A7 7 0 0 1 7.7 3.5a7 7 0 1 0 8.8 8.8z" fill="currentColor" />
        {/if}
      </svg>
    </button>
  {/each}
</div>

<style lang="scss">
  // Three small icon buttons in a sunk track; the current choice gets the rust pill, like the nav.
  .theme-switch {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--radius-pill);
    background: var(--color-sunk);
  }

  .theme-switch > .option {
    display: grid;
    place-items: center;
    width: 32px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;

    &:hover {
      color: var(--color-fg);
    }

    &[aria-pressed='true'] {
      background: var(--color-accent);
      color: var(--color-on-accent);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  .option > .icon {
    width: 16px;
    height: 16px;
  }
</style>
