<script lang="ts">
  import type { Snippet } from 'svelte';
  import { iconUrl } from '~/lib/data/index.ts';
  import type { Part } from '~/lib/data/types.ts';
  import GameIcon from '../GameIcon/GameIcon.svelte';
  import KeywordText from '../KeywordText/KeywordText.svelte';
  import Tag from '../Tag/Tag.svelte';

  interface Props {
    part: Part;
    /** Shown instead of the part's own name, e.g. a family name without its "II". */
    name?: string;
    situational?: boolean;
    /** Makes the card itself pick the part (the footer's own buttons still work). */
    onselect?: () => void;
    disabled?: boolean;
    /** The strip under the card: rarity chips, an Add or remove button. */
    footer?: Snippet;
  }

  const { part, name = part.name, situational = false, onselect, disabled = false, footer }: Props = $props();
  const art = $derived(iconUrl(part.art));
  const rarity = $derived(part.rarity.toLowerCase());
</script>

{#snippet face()}
  <span class="art">
    {#if art}<img class="image" src={art} alt="" loading="lazy" decoding="async" width="236" height="122" />{/if}
    {#if situational}<span class="situational"><Tag variant="cond">Situational</Tag></span>{/if}
    <span class="badge"><GameIcon name={part.icon} size="sm" /></span>
  </span>
  <span class="name">{name}</span>
  <span class="desc"><KeywordText text={part.desc} keywords={part.hl} /></span>
{/snippet}

<article class={['part-card', `-${rarity}`, disabled && '-disabled']}>
  {#if onselect}
    <button type="button" class="face" {disabled} onclick={onselect} aria-label={`Add ${part.name}`}>{@render face()}</button>
  {:else}
    <div class="face">{@render face()}</div>
  {/if}
  {#if footer}<footer class="strip">{@render footer()}</footer>{/if}
</article>

<style lang="scss">
  // The game's reward-screen card: art with the part's icon badge, the name in caps, the effect with gold keywords,
  // and a strip in the rarity's colour underneath.
  .part-card {
    --keyword-color: var(--color-mustard);

    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    overflow: hidden;
    border: 2px solid transparent;
    border-radius: var(--radius-lg);
    background: var(--color-teal);
    box-shadow: 0 2px 0 rgb(0 0 0 / 18%);
    color: var(--color-on-teal);
    text-align: center;

    &.-common { --rarity: var(--color-rarity-common); }
    &.-rare { --rarity: var(--color-rarity-rare); }
    &.-epic { --rarity: var(--color-rarity-epic); }
    &.-legendary { --rarity: var(--color-rarity-legendary); }
    &.-faulty { --rarity: var(--color-down); }

    &:has(> button.face:hover:not(:disabled)) {
      border-color: var(--color-mustard);
    }

    &.-disabled > .face {
      opacity: 0.5;
    }
  }

  .part-card > .face {
    display: grid;
    grid-template-rows: auto auto 1fr;
    align-content: start;
    padding: 0 0 10px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: inherit;

    &:is(button) {
      cursor: pointer;
    }

    &:is(button):hover:not(:disabled) .name {
      color: var(--color-mustard);
    }

    &:is(button):disabled {
      cursor: default;
    }
  }

  .face > .art {
    position: relative;
    display: block;
    aspect-ratio: 236 / 122;
    margin: 6px 6px 0;
    overflow: hidden;
    border-radius: 7px;
    background: rgb(0 0 0 / 25%);

    .image {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .situational {
      position: absolute;
      top: 4px;
      left: 4px;
    }

    .badge {
      position: absolute;
      right: 4px;
      bottom: 4px;
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #f3ead6; // the game's cream badge, the same in both themes
      color: #1d2428;
    }
  }

  .face > .name {
    padding: 8px 8px 0;
    font: 800 12px/1.2 var(--font-display);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .face > .desc {
    padding: 5px 10px 0;
    font-size: 13.5px;
    line-height: 1.35;
  }

  .part-card > .strip {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    justify-content: center;
    padding: 6px;
    border-top: 4px solid var(--rarity, var(--color-line));
    background: var(--color-panel);
    color: var(--color-fg);
  }
</style>
