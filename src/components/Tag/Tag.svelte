<script lang="ts" module>
  export type TagVariant = 'default' | 'cond' | 'good' | 'neg';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** cond: situational effects; good: a recommendation or upgrade; neg: a drawback. */
    variant?: TagVariant;
    children: Snippet;
  }

  const { variant = 'default', children }: Props = $props();
</script>

<span class={['tag-label', variant !== 'default' && `-${variant}`]}>{@render children()}</span>

<style lang="scss">
  .tag-label {
    padding: 4px 7px 3px;
    border-radius: var(--radius-sm);
    background: var(--color-sunk);
    color: var(--color-muted);
    font: 700 11.5px/1 var(--font-label);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;

    &.-cond {
      background: var(--color-cond-bg);
      color: var(--color-cond);
    }

    &.-good {
      background: var(--color-accent-soft);
      color: var(--color-accent);
    }

    &.-neg {
      color: var(--color-down);
    }
  }
</style>
