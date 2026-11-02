<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** The text that shows the tip, e.g. a trait name. */
    text: string;
    children: Snippet;
  }

  const { text, children }: Props = $props();
  const id = $props.id();
  let trigger: HTMLSpanElement | undefined = $state();
  let panel: HTMLSpanElement | undefined = $state();

  // A native manual popover sits in the top layer, so no panel or drawer clips it. It opens on hover and on keyboard
  // focus (and on tap, for touch screens), and is placed under its text, or above it when there's no room below.
  function show(): void {
    if (!trigger || !panel || panel.matches(':popover-open')) return;
    panel.showPopover();
    const r = trigger.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 32);
    panel.style.width = `${String(width)}px`;
    const left = Math.max(16, Math.min(r.left, window.innerWidth - width - 16));
    const below = r.bottom + 6 + panel.offsetHeight <= window.innerHeight;
    panel.style.left = `${String(left)}px`;
    panel.style.top = `${String(below ? r.bottom + 6 : Math.max(8, r.top - panel.offsetHeight - 6))}px`;
  }

  function hide(): void {
    if (panel?.matches(':popover-open')) panel.hidePopover();
  }
</script>

<span
  bind:this={trigger}
  class="hover-tip"
  tabindex="0"
  aria-describedby={id}
  onmouseenter={show}
  onmouseleave={hide}
  onfocus={show}
  onblur={hide}
  onclick={() => { if (panel?.matches(':popover-open')) hide(); else show(); }}
  onkeydown={(e) => { if (e.key === 'Escape') hide(); }}
  role="button"
>{text}</span><span bind:this={panel} {id} popover="manual" role="tooltip" class="tip-panel">{@render children()}</span>

<style lang="scss">
  // Text with a dotted underline that shows a short explanation on hover, focus or tap.
  .hover-tip {
    border-bottom: 1px dotted currentColor;
    white-space: nowrap; // a name stays whole; the list wraps between names
    cursor: help;

    &:focus-visible {
      border-radius: 2px;
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  .tip-panel {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 8px 10px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-panel);
    box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
    color: var(--color-fg);
    font: normal 13px/1.4 var(--font-body);
    text-align: left;
  }
</style>
