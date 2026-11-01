<script lang="ts" module>
  export type ButtonVariant = 'default' | 'primary' | 'quiet';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLButtonAttributes, 'class' | 'children'> {
    /** primary: the one main action (rust pill); quiet: low-emphasis, no border. */
    variant?: ButtonVariant;
    size?: 'md' | 'sm';
    children: Snippet;
  }

  const { variant = 'default', size = 'md', type = 'button', children, ...rest }: Props = $props();
</script>

<button {type} class={['action-button', variant !== 'default' && `-${variant}`, size === 'sm' && '-small']} {...rest}>
  {@render children()}
</button>

<style lang="scss">
  // Secondary buttons echo the game's italic condensed prompts; the primary one is the rust pill from its menus.
  .action-button {
    display: inline-flex;
    gap: var(--space-2);
    align-items: center;
    justify-content: center;
    padding: 9px 14px;
    border: 1.5px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-panel);
    color: var(--color-fg);
    font: italic 600 15px/1 var(--font-label);
    cursor: pointer;

    &:hover:not(:disabled) {
      border-color: var(--color-fg);
    }

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }

    &.-primary {
      padding: 10px 18px;
      border-color: var(--color-accent);
      border-radius: var(--radius-pill);
      background: var(--color-accent);
      color: var(--color-on-accent);
      font: 800 12px/1 var(--font-display);
      letter-spacing: 0.04em;
      text-transform: uppercase;

      &:hover:not(:disabled) {
        border-color: var(--color-fg);
      }
    }

    &.-quiet {
      border-color: transparent;
      background: transparent;

      &:hover:not(:disabled) {
        border-color: transparent;
        background: var(--color-sunk);
      }
    }

    &.-small {
      padding: 5px 10px;
      font-size: 13px;
    }
  }
</style>
