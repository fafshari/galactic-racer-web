<script lang="ts" module>
  import type { OfferRarity } from '~/lib/data/types.ts';

  export const RARITIES: readonly OfferRarity[] = ['Common', 'Rare', 'Epic', 'Legendary'];
</script>

<script lang="ts">
  interface Props {
    value: OfferRarity;
    /** Rarities this part comes in; the others show as unavailable. */
    available: readonly OfferRarity[];
    onchange: (rarity: OfferRarity) => void;
    /** Accessible name of the group, e.g. "Afterburner Efficiency rarity". */
    label?: string;
  }

  const { value, available, onchange, label = 'Rarity' }: Props = $props();
</script>

<span class="rarity-toggle" role="group" aria-label={label}>
  {#each RARITIES as r (r)}
    <button
      type="button"
      class={['chip', `-${r.toLowerCase()}`]}
      aria-label={r}
      aria-pressed={r === value}
      disabled={!available.includes(r)}
      title={available.includes(r) ? r : `${r} (not available)`}
      onclick={() => { onchange(r); }}>{r[0]}</button
    >
  {/each}
</span>

<style lang="scss">
  // Common to Legendary as white, bronze, silver and gold chips.
  .rarity-toggle {
    display: inline-flex;
    gap: 3px;
  }

  .rarity-toggle > .chip {
    display: grid;
    place-items: center;
    width: 24px;
    height: 22px;
    padding: 0;
    border: 1.5px solid var(--chip);
    border-radius: 4px;
    background: transparent;
    color: var(--color-muted);
    font: 700 12px/1 var(--font-label);
    cursor: pointer;

    &.-common { --chip: var(--color-rarity-common); }
    &.-rare { --chip: var(--color-rarity-rare); }
    &.-epic { --chip: var(--color-rarity-epic); }
    &.-legendary { --chip: var(--color-rarity-legendary); }

    &:hover:not(:disabled) {
      background: color-mix(in srgb, var(--chip) 30%, transparent);
      color: var(--color-fg);
    }

    &[aria-pressed='true'] {
      background: var(--chip);
      color: #1d2428; // dark ink on every chip colour, in both themes
    }

    &:disabled {
      border-style: dashed;
      opacity: 0.3;
      cursor: default;
    }
  }
</style>
