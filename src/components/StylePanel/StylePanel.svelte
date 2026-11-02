<script lang="ts">
  import type { IconName } from '~/lib/data/types.ts';
  import Button from '../Button/Button.svelte';
  import GameIcon from '../GameIcon/GameIcon.svelte';

  interface Props {
    name: string;
    icon: IconName;
    /** Campaign styles have ranks; shown after the name. */
    rank?: number | null;
    traits: readonly { name: string; desc: string }[];
    /** Shows a Change button (opens the style picker). */
    onchange?: () => void;
  }

  const { name, icon, rank = null, traits, onchange }: Props = $props();
</script>

<section class="style-panel" aria-label="Racer style">
  <header class="head">
    <GameIcon name={icon} size="xl" />
    <div class="titles">
      <span class="eyebrow">Racer style</span>
      <h3 class="name">{name}{#if rank !== null}<span class="rank">&nbsp;· rank {rank}</span>{/if}</h3>
    </div>
    {#if onchange}<Button size="sm" onclick={onchange}>Change</Button>{/if}
  </header>
  <ul class="traits">
    {#each traits as t (t.name)}
      <li class="trait"><span class="name">{t.name}</span><span class="desc">{t.desc}</span></li>
    {/each}
  </ul>
</section>

<style lang="scss">
  // The middle panel of the game's build overview: the style, then each trait as a muted heading and its effect.
  .style-panel {
    display: grid;
    gap: var(--space-3);
  }

  .style-panel > .head {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    color: var(--color-fg);
  }

  .head > .titles {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
  }

  .titles > .eyebrow {
    color: var(--color-muted);
    font: 800 11px/1 var(--font-display);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .titles > .name {
    font-size: 18px;
    font-weight: 900;
    overflow-wrap: anywhere;

    .rank {
      color: var(--color-muted);
      font: italic 500 14px var(--font-label);
      text-transform: none;
    }
  }

  .style-panel > .traits {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .traits > .trait {
    display: grid;
    gap: 2px;
  }

  .trait > .name {
    color: var(--color-muted);
    font: 700 12px/1.2 var(--font-display);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .trait > .desc {
    font: italic 500 14.5px/1.35 var(--font-label);
  }
</style>
