<script lang="ts">
  import type { ActiveCount, Build } from '~/lib/engine/build.ts';
  import type { Evaluation } from '~/lib/engine/evaluate.ts';
  import type { Speeds } from '~/lib/engine/speeds.ts';
  import { conditionLabel } from '~/lib/format/format.ts';
  import type { ChangeGroup } from '~/lib/planner/readout.ts';
  import ChangeRow from '../ChangeRow/ChangeRow.svelte';
  import InfoTip from '../InfoTip/InfoTip.svelte';
  import Panel from '../Panel/Panel.svelte';
  import SituationalEffect from '../SituationalEffect/SituationalEffect.svelte';
  import SpeedPanel from '../SpeedPanel/SpeedPanel.svelte';

  interface Props {
    build: Build;
    result: Evaluation;
    speeds: Speeds;
    groups: ChangeGroup[];
    /** e.g. "Speeder Bike · Clean Racer". */
    summary: string;
    onactive: (key: string, value: ActiveCount | undefined) => void;
  }

  const { build, result, speeds, groups, summary, onactive }: Props = $props();
</script>

<div class="planner-readout">
  <Panel title="Build readout">
    {#snippet actions()}<span class="summary">{summary}</span>{/snippet}
    <SpeedPanel {speeds} powerBonus={result.powerBonus} />
  </Panel>

  <Panel title="Situational effects">
    {#snippet actions()}
      <InfoTip label="Situational effects">
        <p>Effects that only apply in some situations, like "while Surging" or "after a takedown". Tick one to add it to the numbers.</p>
        <p>Effects that stack each time they trigger take a count instead.</p>
      </InfoTip>
    {/snippet}
    {#if result.conditionals.length}
      <div class="effects">
        {#each result.conditionals as c (c.key)}
          <SituationalEffect
            owner={c.owner}
            detail={conditionLabel(c)}
            {...c.desc ? { desc: c.desc } : {}}
            repeatable={c.repeatable}
            value={build.active[c.key]}
            onchange={(v: ActiveCount | undefined) => { onactive(c.key, v); }}
          />
        {/each}
      </div>
    {:else}
      <p class="empty">None in this build. Parts and traits with "while…" or "after…" effects appear here.</p>
    {/if}
  </Panel>

  <Panel title="What changes">
    {#snippet actions()}
      <span class="legend">Base → with this build</span>
      <InfoTip label="Reading the numbers">
        <p>Each row shows the base value for your vehicle, then the value with this build and the % change. The tags underneath say which upgrade, part or trait caused it.</p>
        <p>"of default" means the base value is built into the game's code and isn't in any data file, so only the change is shown.</p>
        <p>Values are combined as (base + adds + base × % adds) × multipliers. Speeds are shown in km/h; the game stores them in mph.</p>
      </InfoTip>
    {/snippet}
    {#each groups as g (g.heading)}
      <div class="group">
        <h3 class="heading">{g.heading}{#if g.desc}<InfoTip label={g.heading}><p>{g.desc}</p></InfoTip>{/if}</h3>
        {#each g.rows as r (r.key)}
          <ChangeRow view={r.view} {...r.pinned ? { pinnedNote: 'No bonus from this build' } : {}} />
        {/each}
      </div>
    {/each}
  </Panel>
</div>

<style lang="scss">
  .planner-readout {
    display: grid;
    gap: var(--space-4);
    align-content: start;
  }

  .summary,
  .legend {
    color: var(--color-muted);
    font: italic 500 14px var(--font-label);
  }

  .effects {
    display: grid;
    gap: var(--space-2);
  }

  .empty {
    margin: 0;
    color: var(--color-muted);
    font-size: 13.5px;
  }

  .group {
    display: grid;
  }

  .group > .heading {
    display: flex;
    align-items: baseline;
    margin: var(--space-3) 0 var(--space-1);
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.02em;
  }
</style>
