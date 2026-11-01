<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** What the tip explains; the button is announced as "About {label}". */
    label: string;
    children: Snippet;
  }

  const { label, children }: Props = $props();
  const id = $props.id();
  let button: HTMLButtonElement | undefined = $state();
  let panel: HTMLDivElement | undefined = $state();
  let open = $state(false);

  // The panel is a native popover: it sits in the top layer (never clipped by a scrolling drawer), closes on
  // Escape or a click elsewhere, and is placed next to its button when it opens.
  function place(): void {
    if (!button || !panel) return;
    const r = button.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 32);
    panel.style.width = `${width}px`;
    const left = Math.max(16, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 16));
    const below = r.bottom + 8 + panel.offsetHeight <= window.innerHeight;
    panel.style.left = `${left}px`;
    panel.style.top = `${below ? r.bottom + 8 : Math.max(8, r.top - panel.offsetHeight - 8)}px`;
  }
</script>

<button bind:this={button} type="button" class="info-tip" popovertarget={id} aria-label={`About ${label}`} aria-expanded={open}>i</button>
<div
  bind:this={panel}
  {id}
  popover="auto"
  class="info-panel"
  ontoggle={(e: ToggleEvent) => {
    open = e.newState === 'open';
    if (open) place();
  }}
>
  {@render children()}
</div>

<style lang="scss">
  .info-tip {
    display: inline-grid;
    flex: none;
    place-items: center;
    width: 16px;
    height: 16px;
    margin-left: 6px;
    padding: 0;
    border: 1px solid currentColor;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    font: italic 700 11px/1 var(--font-label);
    text-transform: none;
    letter-spacing: 0;
    vertical-align: 1px;
    opacity: 0.75;
    cursor: help;

    &:hover,
    &[aria-expanded='true'] {
      color: var(--color-accent);
      opacity: 1;
    }
  }

  .info-panel {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 10px 12px;
    border: 1px solid var(--color-line);
    border-top: 4px solid var(--color-accent);
    border-radius: var(--radius-md);
    background: var(--color-panel);
    box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
    color: var(--color-fg);
    font: 13px/1.45 var(--font-body);
    text-align: left;
    text-transform: none;
    letter-spacing: 0;

    // tip content comes from the parent's snippet, so it isn't in this component's style scope
    :global(p) {
      margin: 0 0 6px;
    }

    :global(p:last-child) {
      margin-bottom: 0;
    }
  }
</style>
