<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { COLLAPSED_KEY, parseCollapsed, setCollapsed } from '~/lib/collapsed.ts';

  interface Props {
    /** Panel heading in the game's wide caps; omit for an untitled card. */
    title?: string;
    /** A short status after the title, e.g. "3 / 10". */
    count?: string;
    /** Controls at the right of the heading, e.g. an Add button or an InfoTip. */
    actions?: Snippet;
    /** Makes the title collapse the panel; the key remembers the choice in the browser, e.g. "planner.parts". */
    collapseKey?: string;
    children: Snippet;
  }

  const { title, count, actions, collapseKey, children }: Props = $props();
  const id = $props.id();
  let collapsed = $state(false);

  const saved = (): Set<string> => {
    try {
      return parseCollapsed(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]'));
    } catch {
      return new Set();
    }
  };

  onMount(() => {
    if (collapseKey) collapsed = saved().has(collapseKey);
  });

  function toggle(): void {
    if (!collapseKey) return;
    collapsed = !collapsed;
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(setCollapsed(saved(), collapseKey, collapsed)));
    } catch {
      // storage blocked: the panel still collapses for this visit
    }
  }
</script>

<section class={['build-panel', collapsed && '-collapsed']} aria-labelledby={title ? `${id}-title` : undefined}>
  {#if title !== undefined || actions !== undefined}
    <header class="head">
      {#if title && collapseKey}
        <h2 class="title" id={`${id}-title`}>
          <button type="button" class="toggle" aria-expanded={!collapsed} aria-controls={`${id}-body`} onclick={toggle}>
            <span class="chevron" aria-hidden="true"></span>{title}{#if count}<span class="count">{count}</span>{/if}
          </button>
        </h2>
      {:else if title}
        <h2 class="title" id={`${id}-title`}>{title}{#if count}<span class="count">{count}</span>{/if}</h2>
      {/if}
      {#if actions}<div class="actions">{@render actions()}</div>{/if}
    </header>
  {/if}
  <div class="body" id={`${id}-body`} hidden={collapsed}>
    {@render children()}
  </div>
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

  // A collapsible title: the whole title is the button, with a chevron that turns when collapsed.
  .title > .toggle {
    display: flex;
    gap: var(--space-2);
    align-items: baseline;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
    text-align: left;
    text-transform: inherit;
    cursor: pointer;

    &:hover {
      color: var(--color-accent);
    }

    &:focus-visible {
      border-radius: 2px;
      outline: 2px solid var(--color-accent);
      outline-offset: 3px;
    }

    .chevron {
      width: 7px;
      height: 7px;
      border-right: 2px solid currentColor;
      border-bottom: 2px solid currentColor;
      transform: translateY(-2px) rotate(45deg);
      transition: transform 0.15s;
    }

    &[aria-expanded='false'] .chevron {
      transform: translateY(0) rotate(-45deg);
    }

    .count {
      color: var(--color-muted);
      font: italic 500 14px var(--font-label);
      letter-spacing: 0;
      text-transform: none;
    }
  }

  .build-panel > .body {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }

  .head > .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
</style>
