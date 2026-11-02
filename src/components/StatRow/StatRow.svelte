<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { IconName } from '~/lib/data/types.ts';
  import GameIcon from '../GameIcon/GameIcon.svelte';
  import InfoTip from '../InfoTip/InfoTip.svelte';
  import StatPips from '../StatPips/StatPips.svelte';

  interface Props {
    icon: IconName;
    /** The stat, e.g. "Cornering". */
    name: string;
    /** The vehicle part behind it, e.g. "Repulsor Grip". */
    part?: string;
    level: number;
    max?: number;
    /** Makes the pips clickable. */
    onchange?: (level: number) => void;
    /** Tooltip content explaining what the stat changes. */
    tip?: Snippet;
  }

  const { icon, name, part, level, max = 10, onchange, tip }: Props = $props();
</script>

<div class="stat-row">
  <div class="bar">
    <span class="icon"><GameIcon name={icon} size="md" /></span>
    <span class="name">
      <span class="title">{name}{#if tip}<InfoTip label={name}>{@render tip()}</InfoTip>{/if}</span>
      {#if part}<small class="part">{part}</small>{/if}
    </span>
    <span class="pips"><StatPips {level} {max} label={name} {...onchange ? { onchange } : {}} /></span>
    <output class="value">{level}</output>
  </div>
</div>

<style lang="scss">
  // One stat in the game's build panel: a teal bar with the icon, the name and its pips.
  // The row adapts to its own width, not the screen's: the stats panel can be narrow on any screen.
  .stat-row {
    container-type: inline-size;
  }

  .stat-row > .bar {
    display: grid;
    grid-template-columns: auto 132px minmax(0, 1fr) 30px;
    gap: 10px;
    align-items: center;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--color-teal);
    color: var(--color-on-teal);

    // Below this, ten full-size pips no longer fit beside the name (they'd shrink and slide under the level),
    // so they take a line of their own.
    @container (width < 440px) {
      grid-template-columns: 32px minmax(0, 1fr) 30px; // fixed: an auto column would grow to fit the pips row
      grid-template-areas:
        'icon name value'
        'pips pips pips';
      gap: 4px 8px;
      padding: 6px 8px;

      > .icon { grid-area: icon; }
      > .name { grid-area: name; }
      > .value { grid-area: value; }
      > .pips { grid-area: pips; }
    }
  }

  .bar > .icon {
    display: grid;
  }

  // a wrapper the row owns, so the grid can place it (scoped styles can't reach StatPips' own root)
  .bar > .pips {
    display: grid;
    min-width: 0;
  }

  .bar > .name {
    display: grid;
    min-width: 0;
    line-height: 1.2;
  }

  .name > .title {
    font-weight: 600;
    white-space: nowrap;
  }

  .name > .part {
    font-size: 12px;
    opacity: 0.7;
  }

  .bar > .value {
    font: 800 16px var(--font-display);
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
  }
</style>
