<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Panel heading in the game's wide caps; omit for an untitled card. */
    title?: string;
    /** A short status after the title, e.g. "3 / 10". */
    count?: string;
    /** Controls at the right of the heading, e.g. an Add button or an InfoTip. */
    actions?: Snippet;
    children: Snippet;
  }

  const { title, count, actions, children }: Props = $props();
  const id = $props.id();
</script>

<section class="build-panel" aria-labelledby={title ? `${id}-title` : undefined}>
  {#if title !== undefined || actions !== undefined}
    <header class="head">
      {#if title}<h2 class="title" id={`${id}-title`}>{title}{#if count}<span class="count">{count}</span>{/if}</h2>{/if}
      {#if actions}<div class="actions">{@render actions()}</div>{/if}
    </header>
  {/if}
  {@render children()}
</section>

<style lang="scss">
  // One panel of the game's build overview: a heading strip, then its content.
  .build-panel {
    display: grid;
    gap: var(--space-3);
    align-content: start;
    min-width: 0;
    padding: var(--space-4);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-panel);
    box-shadow: 0 1px 0 var(--color-line);
  }

  .build-panel > .head {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    justify-content: space-between;
  }

  .head > .title {
    display: flex;
    gap: var(--space-2);
    align-items: baseline;
    font-size: 12.5px;
    font-weight: 800;
    letter-spacing: 0.05em;

    .count {
      color: var(--color-muted);
      font: italic 500 14px var(--font-label);
      letter-spacing: 0;
      text-transform: none;
    }
  }

  .head > .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
</style>
