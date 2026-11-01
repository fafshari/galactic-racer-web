<script lang="ts" generics="T extends string">
  interface Props {
    options: readonly { value: T; label: string }[];
    value: T;
    /** Accessible name of the group, e.g. "Game mode". */
    label: string;
    onchange: (value: T) => void;
  }

  const { options, value, label, onchange }: Props = $props();
</script>

<div class="mode-switch" role="group" aria-label={label}>
  {#each options as o (o.value)}
    <button type="button" class="option" aria-pressed={o.value === value} onclick={() => { onchange(o.value); }}>{o.label}</button>
  {/each}
</div>

<style lang="scss">
  // The game's top menu: wide caps, the current choice in a rust pill.
  .mode-switch {
    display: inline-flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .mode-switch > .option {
    padding: 9px 16px;
    border: 0;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-fg);
    font: 800 13px/1 var(--font-display);
    letter-spacing: 0.03em;
    text-transform: uppercase;
    cursor: pointer;

    &:hover {
      background: var(--color-sunk);
    }

    &[aria-pressed='true'] {
      background: var(--color-accent);
      color: var(--color-on-accent);
    }
  }
</style>
