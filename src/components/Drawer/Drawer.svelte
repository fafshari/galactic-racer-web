<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    title: string;
    /** Called when the drawer closes for any reason (Escape, the close button, a click outside). */
    onclose: () => void;
    children: Snippet;
  }

  const { open, title, onclose, children }: Props = $props();
  const id = $props.id();
  let dialog: HTMLDialogElement | undefined = $state();

  // A native modal <dialog> (ADR 0012): the browser traps focus inside it, closes it on Escape, makes the page
  // behind it inert, and returns focus to whatever opened it when it closes.
  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function clickOutside(e: MouseEvent): void {
    // the backdrop belongs to the dialog element itself; clicks on content land on its children
    if (e.target === dialog) dialog.close();
  }
</script>

<dialog bind:this={dialog} class="side-drawer" aria-labelledby={`${id}-title`} {onclose} onclick={clickOutside}>
  <div class="panel">
    <header class="head">
      <h2 class="title" id={`${id}-title`}>{title}</h2>
      <button type="button" class="close" aria-label="Close" onclick={() => dialog?.close()}>×</button>
    </header>
    <div class="body">{@render children()}</div>
  </div>
</dialog>

<style lang="scss">
  @use '../../styles/breakpoints' as bp;

  // Slides in from the right on wide screens; a full-height bottom sheet on phones.
  .side-drawer {
    width: min(520px, 100vw);
    max-width: none;
    height: 100dvh;
    max-height: none;
    margin: 0 0 0 auto;
    padding: 0;
    border: 0;
    background: var(--color-bg);
    color: var(--color-fg);
    box-shadow: -12px 0 40px rgb(0 0 0 / 25%);
    transform: translateX(0);
    transition:
      transform 0.22s ease-out,
      overlay 0.22s allow-discrete,
      display 0.22s allow-discrete;

    @starting-style {
      transform: translateX(100%);
    }

    &:not([open]) {
      transform: translateX(100%);
    }

    &::backdrop {
      background: rgb(10 20 26 / 45%);
    }

    @include bp.phone {
      width: 100vw;
      height: 92dvh;
      margin: auto 0 0;
      border-radius: 14px 14px 0 0;

      @starting-style {
        transform: translateY(100%);
      }

      &:not([open]) {
        transform: translateY(100%);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }

  .side-drawer > .panel {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100%;
  }

  .panel > .head {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4);
    background: linear-gradient(90deg, var(--color-accent) 0 40%, var(--color-mustard) 40% 62%, var(--color-teal) 62%) bottom / 100% 4px no-repeat;
  }

  .head > .title {
    font-size: 16px;
    font-weight: 900;
  }

  .head > .close {
    padding: 0 6px;
    border: 0;
    background: transparent;
    color: var(--color-fg);
    font-size: 26px;
    line-height: 1;
    cursor: pointer;

    &:hover {
      color: var(--color-accent);
    }
  }

  .panel > .body {
    overflow: auto;
    padding: var(--space-4);
    overscroll-behavior: contain;
  }
</style>
