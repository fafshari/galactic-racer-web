<script lang="ts">
  import { highlight } from '~/lib/format/format.ts';

  interface Props {
    text: string;
    /** Phrases the game sets in its keyword style (a part's `hl`). */
    keywords?: readonly string[];
  }

  const { text, keywords = [] }: Props = $props();
  const runs = $derived(highlight(text, keywords));
</script>

<span class="keyword-text">{#each runs as run, i (i)}{#if run.keyword}<em class="keyword">{run.text}</em>{:else}{run.text}{/if}{/each}</span>

<style lang="scss">
  // The game sets mechanic names (Ramjet, Cooled, Takedown) in gold italics; --keyword-color lets a host retint them.
  .keyword-text > .keyword {
    color: var(--keyword-color, var(--color-accent));
    font-style: italic;
    font-weight: 600;
  }
</style>
