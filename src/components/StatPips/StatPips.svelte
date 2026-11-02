<script lang="ts">
  interface Props {
    /** Current level, 0 to `max`. */
    level: number;
    max?: number;
    /** Accessible name of the stat, e.g. "Cornering". */
    label: string;
    /** Makes the pips clickable. Clicking the highest lit pip steps down one level, so 0 is reachable. */
    onchange?: (level: number) => void;
  }

  const { level, max = 10, label, onchange }: Props = $props();

  // the game draws levels 1-7 as dots and 8-10 as taller blocks
  const BLOCKS_FROM = 8;
  const levels = $derived(Array.from({ length: max }, (_, i) => i + 1));

  function pick(n: number): void {
    onchange?.(n === level ? n - 1 : n);
  }
</script>

{#if onchange}
  <span class="stat-pips" role="group" aria-label={`${label} level`}>
    {#each levels as n (n)}
      <button
        type="button"
        class={['pip', n >= BLOCKS_FROM && '-block', n <= level && '-on']}
        aria-label={`Level ${n}`}
        aria-pressed={n <= level}
        onclick={() => { pick(n); }}
      ></button>
    {/each}
  </span>
{:else}
  <span class="stat-pips" role="img" aria-label={`${label} level ${level} of ${max}`}>
    {#each levels as n (n)}
      <span class={['pip', n >= BLOCKS_FROM && '-block', n <= level && '-on']}></span>
    {/each}
  </span>
{/if}

<style lang="scss">
  // Pips sit on the teal stat rows; override --pip-on / --pip-off to place them elsewhere.
  .stat-pips {
    --pip-on: var(--color-on-teal);
    --pip-off: rgb(243 234 214 / 20%);

    display: flex;
    align-items: center;
    min-width: 0;
  }

  .stat-pips > .pip {
    all: unset;
    box-sizing: border-box;
    display: grid;
    flex: 0 1 18px; // no gap between pips, so every pixel of the row is a click target
    place-items: center;
    min-width: var(--pip-min, 13px); // StatRow sets this (lower on narrow rows) and sizes its pips column from it
    height: 24px;

    &::after {
      content: '';
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--pip-off);
    }

    &.-block::after {
      width: 11px;
      height: 15px;
      border-radius: var(--radius-sm);
    }

    &.-on::after {
      background: var(--pip-on);
    }

    &:is(button) {
      cursor: pointer;
    }

    &:is(button):hover::after {
      background: var(--color-mustard);
    }

    &:is(button):focus-visible {
      border-radius: 4px;
      outline: 2px solid var(--color-mustard);
      outline-offset: -1px;
    }
  }
</style>
