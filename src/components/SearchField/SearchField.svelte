<script lang="ts">
  interface Props {
    value: string;
    /** Accessible name, e.g. "Search parts". */
    label: string;
    placeholder?: string;
    oninput: (value: string) => void;
    /** Focus this field when its drawer opens (the dialog honours autofocus). */
    autofocus?: boolean;
  }

  const { value, label, placeholder = '', oninput, autofocus = false }: Props = $props();
</script>

<!-- Only used inside a drawer, where focusing the search is the expected first step. -->
<!-- svelte-ignore a11y_autofocus -->
<input
  class="search-field"
  type="search"
  {value}
  aria-label={label}
  {placeholder}
  autocomplete="off"
  {autofocus}
  oninput={(e) => { oninput(e.currentTarget.value); }}
/>

<style lang="scss">
  .search-field {
    width: 100%;
    min-width: 0;
    padding: 9px 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-panel);
    color: var(--color-fg);
    font: 15px var(--font-body);
  }
</style>
