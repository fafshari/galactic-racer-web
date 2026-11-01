<script lang="ts" module>
  export type IconSize = 'sm' | 'md' | 'lg' | 'xl';
</script>

<script lang="ts">
  import { iconUrl, isGlyph } from '~/lib/data/index.ts';
  import type { IconName } from '~/lib/data/types.ts';

  interface Props {
    name: IconName | null;
    size?: IconSize;
    /** Accessible name; omit for decorative icons next to visible text. */
    label?: string;
  }

  const { name, size = 'md', label }: Props = $props();
  const url = $derived(name === null ? undefined : iconUrl(name));
  // White glyphs are tinted with the current text colour, as the game does; full-colour art shows as-is.
  const glyph = $derived(name !== null && isGlyph(name));
</script>

{#if url}
  {#if glyph}
    <span
      class={['game-icon', `-${size}`, '-glyph']}
      style:--src={`url("${url}")`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    ></span>
  {:else}
    <img class={['game-icon', `-${size}`]} src={url} alt={label ?? ''} loading="lazy" decoding="async" />
  {/if}
{/if}

<style lang="scss">
  .game-icon {
    display: inline-block;
    flex: none;
    object-fit: contain;

    &.-sm {
      width: 22px;
      height: 22px;
    }

    &.-md {
      width: 32px;
      height: 32px;
    }

    &.-lg {
      width: 40px;
      height: 40px;
    }

    &.-xl {
      width: 56px;
      height: 56px;
    }

    &.-glyph {
      background: currentColor;
      mask: var(--src) center / contain no-repeat;
    }
  }
</style>
