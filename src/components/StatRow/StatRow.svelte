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
  <div class="bar" style:--pip-count={max}>
    <span class="icon"><GameIcon name={icon} size="md" /></span>
    <span class="name">
      <span class="title"><span class="label">{name}</span>{#if tip}<InfoTip label={name}>{@render tip()}</InfoTip>{/if}</span>
      {#if part}<small class="part">{part}</small>{/if}
    </span>
    <span class="pips"><StatPips {level} {max} label={name} {...onchange ? { onchange } : {}} /></span>
    <output class="value">{level}</output>
  </div>
</div>

<style lang="scss">
  // One stat in the game's build panel: a teal bar with the icon, the name, its pips and the level, always on one
  // line. The row adapts to its own width, not the screen's, since the stats panel can be narrow on any screen:
  // the name gives up space first (down to an ellipsis), then the pips shrink, never under the level.
  .stat-row {
    container-type: inline-size;
  }

  .stat-row > .bar {
    display: grid;
    --pip-min: 13px;

    // the pips' minimum is explicit: a flex row's min-content doesn't count its items' min-width, so the name
    // column would otherwise keep its 132px and push the pips under the level
    grid-template-columns: auto minmax(0, 132px) minmax(calc(var(--pip-count) * var(--pip-min)), 1fr) 30px;
    gap: 10px;
    align-items: center;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--color-teal);
    color: var(--color-on-teal);

    @container (width < 400px) {
      --pip-min: 11px;

      gap: 6px;
      padding: 6px 8px;
    }
  }

  .bar > .icon {
    display: grid;
  }

  .bar > .pips {
    display: grid;
  }

  .bar > .name {
    display: grid;
    min-width: 0;
    line-height: 1.2;
  }

  .name > .title {
    display: flex;
    align-items: center;
    min-width: 0;
    font-weight: 600;
    white-space: nowrap;
  }

  .title > .label,
  .name > .part {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .name > .part {
    font-size: 12px;
    white-space: nowrap;
    opacity: 0.7;
  }

  .bar > .value {
    font: 800 16px var(--font-display);
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
  }
</style>
