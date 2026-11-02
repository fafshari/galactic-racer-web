<script lang="ts">
  import type { FormattedValue, RowView } from '~/lib/format/format.ts';
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
      <span class={['delta', `-${v.direction}`]}>{v.text}</span>
    {:else}
      <span class="old">{v.base}</span> → <span class={['delta', `-${v.direction}`]}>{v.value}</span>{#if v.percent}&nbsp;({v.percent}){/if}
    {/if}
  </span>
{/snippet}

<div class="change-row">
<div class="line">
  <span class="field">
    {view.label}<InfoTip label={view.label}>{#each view.tip as line, i (i)}<p>{line}</p>{/each}</InfoTip>
  </span>
  <span class="value">
    {#if view.display.kind === 'single' && pinnedNote && view.display.value.kind === 'number'}
      <span class="reading">{view.display.value.value}</span>
    {:else if view.display.kind === 'single'}
      {@render value(view.display.value)}
    {:else if view.display.kind === 'parts'}
      {#each view.display.items as item (item.name)}
        <span class="part"><span class="part-name">{item.name}:</span> {@render value(item.value)}</span>
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
    {@const [inName, outName] = view.display.axes}
    <details class="curve">
      <summary>Show curve</summary>
      <div class="scroll">
        <table class="points">
          <thead><tr><th>{inName}</th><th>{outName}</th><th>New {inName.toLowerCase()}</th><th>New {outName.toLowerCase()}</th></tr></thead>
          <tbody>
            {#each view.display.points as p, i (i)}
              <tr>
                <td>{p.base[0]}</td><td>{p.base[1]}</td>
                <td class={[p.changed[0] && '-changed']}>{p.value[0]}</td><td class={[p.changed[1] && '-changed']}>{p.value[1]}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>
  {/if}
</div>
</div>

<style lang="scss">
  // A container, so the row can stack its value under the label wherever it's placed narrowly.
  .change-row {
    container-type: inline-size;
    border-top: 1px solid var(--color-line);
  }

  .change-row > .line {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 2px 12px;
    padding: 7px 0;
  }

  @container (max-width: 400px) {
    .change-row > .line {
      grid-template-columns: minmax(0, 1fr);
    }

    .line > .value {
      justify-items: start;
      text-align: left;
    }
  }

  .line > .field {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    overflow-wrap: anywhere;
  }

  .line > .value {
    display: grid;
    justify-items: end;
    font: 13px var(--font-mono);
    font-variant-numeric: tabular-nums;
    text-align: right;

    .old,
    .part-name {
      color: var(--color-muted);
    }

    .delta.-up {
      color: var(--color-up);
    }

    .delta.-down {
      color: var(--color-down);
    }
  }

  .line > .sources {
    display: flex;
    flex-wrap: wrap;
    grid-column: 1 / -1;
    gap: 4px;
  }

  .line > .curve {
    grid-column: 1 / -1;

    summary {
      color: var(--color-accent);
      font-size: 12.5px;
      cursor: pointer;
    }

    .scroll {
      overflow-x: auto;
    }

    .points {
      margin-top: 6px;
      border-collapse: collapse;
      font: 12px/1.4 var(--font-mono);
      font-variant-numeric: tabular-nums;
    }

    th,
    td {
      padding: 3px 10px 3px 0;
      text-align: right;
    }

    th {
      color: var(--color-muted);
      font-weight: 500;
    }

    td.-changed {
      font-weight: 700;
    }
  }
</style>
