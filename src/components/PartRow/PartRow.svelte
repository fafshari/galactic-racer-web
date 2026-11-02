<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Part } from '~/lib/data/types.ts';
  import GameIcon from '../GameIcon/GameIcon.svelte';
  import KeywordText from '../KeywordText/KeywordText.svelte';
  import Tag from '../Tag/Tag.svelte';

  interface Props {
    part: Part;
    /** The effect only applies in some situations ("while Surging", "after a takedown"). */
    situational?: boolean;
    onremove?: () => void;
    /** Extra controls, e.g. a rarity toggle. */
    controls?: Snippet;
  }

  const { part, situational = false, onremove, controls }: Props = $props();
  const rarity = $derived(part.rarity === 'Faulty' ? null : part.rarity.toLowerCase());
</script>

<div class={['part-row', rarity && `-${rarity}`]}>
  <span class="badge"><GameIcon name={part.icon} size="md" /></span>
  <div class="body">
    <span class="name">{part.name}</span>
    <span class="desc"><KeywordText text={part.desc} keywords={part.hl} /></span>
  </div>
  <div class="side">
    {#if situational}<Tag variant="cond">Situational</Tag>{/if}
    {#if part.rarity === 'Faulty'}<Tag variant="neg">Faulty</Tag>{/if}
    {#if controls}{@render controls()}{/if}
    {#if onremove}<button type="button" class="remove" aria-label={`Remove ${part.name}`} onclick={onremove}>×</button>{/if}
  </div>
</div>

<style lang="scss">
  // A line in the game's Installed Parts panel: icon badge, name in caps, the effect with its keywords.
  .part-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space-2) var(--space-3);
    align-items: start;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-line);
    border-left: 4px solid var(--rarity, var(--color-line));
    border-radius: var(--radius-md);
    background: var(--color-panel);

    &.-common { --rarity: var(--color-rarity-common); }
    &.-rare { --rarity: var(--color-rarity-rare); }
    &.-epic { --rarity: var(--color-rarity-epic); }
    &.-legendary { --rarity: var(--color-rarity-legendary); }
  }

  .part-row > .badge {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: var(--color-teal);
    color: var(--color-on-teal);
  }

  .part-row > .body {
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
  }

  .part-row > .side {
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
