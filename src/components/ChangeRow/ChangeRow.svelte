<script lang="ts">
  import type { FormattedValue, RowView } from '~/lib/format/format.ts';
  import CurveChart from '../CurveChart/CurveChart.svelte';
  import InfoTip from '../InfoTip/InfoTip.svelte';
  import Tag from '../Tag/Tag.svelte';

  interface Props {
    view: RowView;
    /** Shown instead of sources when nothing in the build touches this field (pinned key stats). */
    pinnedNote?: string;
  }

  const { view, pinnedNote }: Props = $props();
</script>

{#snippet value(v: FormattedValue)}
  <span class="reading">
    {#if v.kind === 'toggle'}
      <span class="old">{v.base}</span> → {v.value}
    {:else if v.kind === 'change'}
      <span class={['delta', `-${v.tone}`]}>{v.text}</span>
    {:else}
      <span class="old">{v.base}</span> → <span class={['delta', `-${v.tone}`]}>{v.value}</span>{#if v.percent}&nbsp;({v.percent}){/if}
    {/if}
  </span>
{/snippet}

<div class="change-row">
<div class="line">
  <span class="field">
    {view.label}{#if view.tip.length}<InfoTip label={view.label}>{#each view.tip as line, i (i)}<p>{line}</p>{/each}</InfoTip>{/if}
  </span>
  <span class={['value', view.display.kind === 'parts' && '-parts']}>
    {#if view.display.kind === 'single' && pinnedNote && view.display.value.kind === 'number'}
      <span class="reading">{view.display.value.value}</span>
    {:else if view.display.kind === 'single'}
      {@render value(view.display.value)}
    {:else if view.display.kind === 'parts'}
      {#each view.display.items as item (item.name)}
        <span class="part"><span class="part-name">{item.name}</span>{@render value(item.value)}</span>
      {/each}
    {:else if view.display.kind === 'curve'}
      {view.display.changedPoints} curve point{view.display.changedPoints === 1 ? '' : 's'} changed
    {:else}
      <span class="part-name">Changed; base curve isn't in the data</span>
    {/if}
  </span>
  <span class="sources">
    {#if pinnedNote}
      <Tag>{pinnedNote}</Tag>
    {:else}
      {#each view.sources as s (s.source)}<Tag variant={s.kind === 'conditional' ? 'cond' : 'default'}>{s.source}</Tag>{/each}
    {/if}
  </span>
  {#if view.display.kind === 'curve'}
    {@const d = view.display}
    <details class="curve">
      <summary>Show curve</summary>
      <div class="body">
        {#if d.explain}<p class="explain">{d.explain}</p>{/if}
        <CurveChart chart={d.chart} axes={d.axes} label={`${view.label}: ${d.changes.join('; ')}`} />
        {#if d.changes.length}
          <ul class="changes">{#each d.changes as c, i (i)}<li>{c}</li>{/each}</ul>
        {/if}
      </div>
    </details>
  {/if}
</div>
</div>

<style lang="scss">
  .change-row {
    border-top: 1px solid var(--color-line);
  }

  // Label and value share a line when they fit; otherwise the value drops below, right-aligned. The label never
  // gets narrower than 11em, so a long value can't squeeze it, and readings never break inside themselves.
  .change-row > .line {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
    align-items: baseline;
    padding: 7px 0;
  }

  .line > .field {
    display: flex;
    flex: 1 1 11em;
    flex-wrap: wrap;
    align-items: baseline;
    min-width: 0;
    overflow-wrap: break-word;
  }

  .line > .sources,
  .line > .curve {
    flex-basis: 100%;
  }

  .line > .value {
    display: grid;
    flex: 0 1 auto;
    justify-items: end;
    max-width: 100%;
    margin-left: auto;
    font: 13px var(--font-mono);
    font-variant-numeric: tabular-nums;
    text-align: right;

    // Several named values (low / mid / high speed): their own block under the label, name left, reading right.
    &.-parts {
      flex-basis: 100%;
      gap: 3px;
      justify-items: stretch;
      padding: 4px 0 2px var(--space-3);
      text-align: left;
    }

    // name and reading share a line when they fit; otherwise the reading drops below, right-aligned
    .part {
      display: flex;
      flex-wrap: wrap;
      gap: 0 12px;
      justify-content: space-between;
    }

    .part > .reading {
      margin-left: auto;
    }

    // a reading never breaks inside itself ("5 s → 4.131 s (−17.4%)" stays whole)
    .reading {
      white-space: nowrap;
    }

    .old,
    .part-name {
      color: var(--color-muted);
    }

    // coloured by whether it's an improvement, not by which way the number moved
    .delta.-good {
      color: var(--color-up);
    }

    .delta.-bad {
      color: var(--color-down);
    }
  }

  .line > .sources {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .line > .curve {
    summary {
      color: var(--color-accent);
      font-size: 12.5px;
      cursor: pointer;
    }

    .body {
      display: grid;
      gap: var(--space-2);
      margin-top: 6px;
    }

    .explain {
      margin: 0;
      color: var(--color-muted);
      font-size: 13px;
    }

    .changes {
      margin: 0;
      padding-left: 1.2em;
      font-size: 13px;
    }
  }
</style>
