<script lang="ts">
  interface Props {
    value: number | null;
    /** Positions up to this one win the bet; they're highlighted. */
    winsUpTo: number;
    onchange: (position: number) => void;
  }

  const { value, winsUpTo, onchange }: Props = $props();
</script>

<div class="finish-picker" role="group" aria-label="Finishing position">
  {#each Array.from({ length: 12 }, (_, i) => i + 1) as n (n)}
    <button type="button" class={['position', n <= winsUpTo && '-wins']} aria-pressed={value === n} aria-label={`Position ${String(n)}${n <= winsUpTo ? ', wins the bet' : ''}`} onclick={() => { onchange(n); }}>P{n}</button>
  {/each}
</div>

<style lang="scss">
  @use '../../styles/breakpoints' as bp;

  .finish-picker {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 6px;

    @include bp.narrow {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
  }

  .finish-picker > .position {
    padding: 10px 0;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-panel);
    color: var(--color-fg);
    font: 800 14px var(--font-display);
    cursor: pointer;

    &.-wins {
      border-color: var(--color-up);
    }

    &[aria-pressed='true'] {
      border-color: var(--color-accent);
      background: var(--color-accent);
      color: var(--color-on-accent);
    }
  }
</style>
