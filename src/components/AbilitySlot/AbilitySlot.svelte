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
  }

  const { ability, label, onselect, onremove }: Props = $props();
</script>

<div class={['ability-slot', ability === null && '-empty']}>
  <button type="button" class="pick" onclick={onselect} aria-label={ability ? `${label}: ${ability.name}. Change` : `${label}: empty. Add an ability`}>
    <span class="badge">{#if ability}<GameIcon name={ability.icon} size="lg" />{/if}</span>
    <span class="text">
      <span class="name">{ability ? ability.name : 'Add ability'}</span>
      <span class="slot">{label}</span>
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
    padding: var(--space-2) var(--space-3);
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
    font: 800 13px/1.2 var(--font-display);
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .text > .slot {
    color: var(--color-muted);
    font: italic 500 13.5px var(--font-label);
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
