<script lang="ts">
  import type { Ability } from '~/lib/data/types.ts';
  import GameIcon from '../GameIcon/GameIcon.svelte';

  interface Props {
    ability: Ability | null;
    /** The slot's name, e.g. "Ability 1". */
    label: string;
    /** Opens the ability picker for this slot. */
    onselect: () => void;
    /** Shows a remove button on a filled slot. */
    onremove?: () => void;
    /** What an empty slot takes, e.g. "crash ability". */
    takes?: string;
    /** The installed ability's reload time with this build, e.g. "Reload 7.5 s (was 15 s)". */
    cooldown?: string;
  }

  const { ability, label, onselect, onremove, takes = 'ability', cooldown }: Props = $props();
</script>

<div class={['ability-slot', ability === null && '-empty']}>
  <button type="button" class="pick" onclick={onselect} aria-label={ability ? `${label}: ${ability.name}${cooldown ? `, ${cooldown}` : ''}. Change` : `${label}: empty. Add ${/^[aeiou]/.test(takes) ? 'an' : 'a'} ${takes}`}>
    <span class="badge">{#if ability}<GameIcon name={ability.icon} size="lg" />{/if}</span>
    <span class="text">
      <span class="name">{ability ? ability.name : `Add ${takes}`}</span>
      <span class="slot">{label}</span>
      {#if ability && cooldown}<span class="cooldown">{cooldown}</span>{/if}
    </span>
  </button>
  {#if ability && onremove}
    <button type="button" class="remove" aria-label={`Remove ${ability.name}`} onclick={onremove}>×</button>
  {/if}
</div>

<style lang="scss">
  // A slot from the game's Abilities panel: a round badge, the ability name in caps, the slot name underneath.
  .ability-slot {
    position: relative;
    display: grid;
  }

  .ability-slot > .pick {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    min-height: 72px;
    padding: var(--space-2) 28px var(--space-2) var(--space-3); // room for the remove button
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-panel);
    color: var(--color-fg);
    text-align: left;
    cursor: pointer;

    &:hover {
      border-color: var(--color-fg);
    }
  }

  .pick > .badge {
    display: grid;
    flex: none;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--color-teal);
    color: var(--color-on-teal);
  }

  .pick > .text {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .text > .name {
    font: 800 12px/1.2 var(--font-display);
    text-transform: uppercase;
    overflow-wrap: break-word; // wrap between words; only split a word that can't fit on its own
  }

  .text > .slot {
    color: var(--color-muted);
    font: italic 500 13.5px var(--font-label);
  }

  .text > .cooldown {
    font: 600 13px var(--font-label);
  }

  .ability-slot.-empty > .pick {
    border-style: dashed;
    background: transparent;

    .badge {
      border: 2px dashed var(--color-line);
      background: transparent;
    }

    .name {
      color: var(--color-muted);
    }
  }

  .ability-slot > .remove {
    position: absolute;
    top: 4px;
    right: 6px;
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
