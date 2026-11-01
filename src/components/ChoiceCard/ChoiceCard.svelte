<script lang="ts">
  import type { IconName } from '~/lib/data/types.ts';
  import GameIcon from '../GameIcon/GameIcon.svelte';

  interface Props {
    icon: IconName | null;
    title: string;
    /** A line under the title, e.g. a vehicle's traits or a style's starting abilities. */
    subtitle?: string;
    pressed: boolean;
    onclick: () => void;
  }

  const { icon, title, subtitle, pressed, onclick }: Props = $props();
</script>

<button type="button" class="choice-card" aria-pressed={pressed} {onclick}>
  <GameIcon name={icon} size="lg" />
  <span class="text">
    <span class="title">{title}</span>
    {#if subtitle}<span class="subtitle">{subtitle}</span>{/if}
  </span>
</button>

<style lang="scss">
  @use '../../styles/breakpoints' as bp;

  // A vehicle or racer style option: icon, name in wide caps, a muted line underneath.
  .choice-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-panel);
    color: var(--color-fg);
    text-align: left;
    cursor: pointer;

    &:hover {
      border-color: var(--color-fg);
    }

    &[aria-pressed='true'] {
      border-color: var(--color-accent);
      background: var(--color-accent-soft);
      color: var(--color-fg);
    }
  }

  .choice-card > .text {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .text > .title {
    font: 700 13px/1.25 var(--font-display);
    letter-spacing: 0.01em;
    text-transform: uppercase;
    overflow-wrap: anywhere;

    @include bp.phone {
      font: 700 15px/1.2 var(--font-label);
      letter-spacing: 0.03em;
    }
  }

  .text > .subtitle {
    color: var(--color-muted);
    font-size: 13px;
  }
</style>
