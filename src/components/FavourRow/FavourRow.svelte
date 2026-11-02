<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Favour } from '~/lib/data/types.ts';
  import GameIcon from '../GameIcon/GameIcon.svelte';
  import Tag from '../Tag/Tag.svelte';

  interface Props {
    favour: Favour;
    situational?: boolean;
    /** Show how the favour is unlocked (in the picker). */
    showUnlock?: boolean;
    onremove?: () => void;
    /** Extra controls, e.g. an Add button. */
    controls?: Snippet;
  }

  const { favour, situational = false, showUnlock = false, onremove, controls }: Props = $props();
</script>

<div class={['favour-row', favour.negative && '-drawback']}>
  <span class="badge"><GameIcon name={favour.icon} size="md" /></span>
  <div class="body">
    <span class="name">{favour.name}</span>
    <span class="desc">{favour.desc}{#if showUnlock && favour.unlock}<span class="unlock"> · Unlock: {favour.unlock}</span>{/if}</span>
  </div>
  <div class="side">
    <Tag>Rank {favour.rank}</Tag>
    {#if favour.negative}<Tag variant="neg">Drawback</Tag>{/if}
    {#if situational}<Tag variant="cond">Situational</Tag>{/if}
    {#if controls}{@render controls()}{/if}
    {#if onremove}<button type="button" class="remove" aria-label={`Remove ${favour.name}`} onclick={onremove}>×</button>{/if}
  </div>
</div>

<style lang="scss">
  // A Campaign favour: like an installed part, with its rank and whether it's a drawback.
  .favour-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space-2) var(--space-3);
    align-items: start;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-line);
    border-left: 4px solid var(--color-mustard);
    border-radius: var(--radius-md);
    background: var(--color-panel);

    &.-drawback {
      border-left-color: var(--color-down);
    }
  }

  .favour-row > .badge {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: var(--color-teal);
    color: var(--color-on-teal);
  }

  .favour-row > .body {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .body > .name {
    font: 800 13px/1.2 var(--font-display);
    text-transform: uppercase;
  }

  .body > .desc {
    color: var(--color-muted);
    font-size: 13.5px;
    line-height: 1.35;

    .unlock {
      font-style: italic;
    }
  }

  .favour-row > .side {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    grid-column: 2; // tags and controls get their own line under the text, so nothing overflows a narrow panel
    align-items: center;

    &:empty {
      display: none;
    }
  }

  .side > .remove {
    margin-left: auto;
    padding: 0 4px;
    border: 0;
    background: transparent;
    color: var(--color-muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;

    &:hover {
      color: var(--color-down);
    }
  }
</style>
