<script lang="ts">
  import { toKmh, type Speeds } from '~/lib/engine/speeds.ts';
  import InfoTip from '../InfoTip/InfoTip.svelte';

  interface Props {
    speeds: Speeds;
    /** Extra Power from counted Speed procs (shown so the top speed is explained). */
    powerBonus?: number;
  }

  const { speeds, powerBonus = 0 }: Props = $props();
  const kmh = (mph: number): number => Math.round(toKmh(mph));
  const top = $derived(kmh(speeds.top));
  const gain = $derived(top - kmh(speeds.baseTop));
</script>

<div class="speed-panel">
  <div class="poster">
    <span class="number">{top}</span><span class="unit">km/h</span>
    <span class="caption">
      Top speed<InfoTip label="Top speed">
        <p>Your top speed with no boost active: the vehicle's base top speed plus everything in this build, including situational effects you've counted.</p>
        <p>Parts that increase Speed raise your Power rating, and each Power point adds top speed just like an upgrade level.</p>
        <p>Real races also depend on drag, terrain and handling, so treat this as the ceiling.</p>
      </InfoTip>
      · base {kmh(speeds.baseTop)} km/h{#if gain !== 0}, {gain > 0 ? '+' : ''}{gain} from this build{/if}{#if powerBonus}
        (incl. +{powerBonus} power from Speed gains){/if}
    </span>
  </div>
  <div class="boosts">
    <div class="tile">
      <span class="number">{kmh(speeds.top + speeds.afterburner)}<small>km/h</small></span>
      <span class="label">With Afterburner<InfoTip label="With Afterburner"><p>Top speed plus the Afterburner's top-speed bonus (base 64.4 km/h, raised by Afterburner-power parts).</p></InfoTip></span>
      <span class="detail">+{kmh(speeds.afterburner)} km/h</span>
    </div>
    <div class="tile">
      <span class="number">{kmh(speeds.top + speeds.ramjet)}{#if !speeds.ramjetKnown}&nbsp;+ ?{/if}<small>km/h</small></span>
      <span class="label">With Ramjet<InfoTip label="With Ramjet">
        <p>Top speed plus the Ramjet's top-speed bonus (base 128.7 km/h, raised by Boost upgrades and Ramjet-power parts).</p>
        <p>The base isn't in the game data: it was measured in game (80 mph).</p>
      </InfoTip></span>
      <span class="detail">+{kmh(speeds.ramjet)} km/h · {speeds.ramjetKnown ? 'base measured' : 'unknown base'}</span>
    </div>
    <div class="tile">
      <span class="number">+{kmh(speeds.surge)}<small>km/h</small></span>
      <span class="label">Surge<InfoTip label="Surge">
        <p>Speed Surging adds on top of your top speed, for as long as you're Surging.</p>
        <p>The burst is a short spike when Surging starts: it ramps in over 0.15 s, holds until 0.35 s and fades out by 1.4 s.</p>
      </InfoTip></span>
      <span class="detail">while Surging · burst +{kmh(speeds.surgeBurst)} km/h</span>
    </div>
  </div>
</div>

<style lang="scss">
  @use '../../styles/breakpoints' as bp;

  .speed-panel {
    display: grid;
    gap: var(--space-2);
  }

  // The poster card: racing stripes down the left edge, cream type on teal.
  .speed-panel > .poster {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    align-items: baseline;
    padding: 14px 16px 14px 30px;
    border-radius: var(--radius-md);
    background: linear-gradient(90deg, var(--color-accent) 0 9px, var(--color-mustard) 9px 16px, var(--color-teal) 16px);
    color: var(--color-on-teal);
  }

  .poster > .number {
    font: 900 46px/1 var(--font-display);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .poster > .unit {
    font: 800 15px/1 var(--font-display);
    text-transform: uppercase;
    opacity: 0.8;
  }

  .poster > .caption {
    flex-basis: 100%;
    font: italic 500 14.5px/1.3 var(--font-label);
    opacity: 0.85;
  }

  .speed-panel > .boosts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);

    @include bp.phone {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .boosts > .tile {
    display: grid;
    gap: 3px;
    padding: 10px 12px;
    border-top: 3px solid var(--color-mustard);
    border-radius: var(--radius-md);
    background: var(--color-sunk);
  }

  .tile > .number {
    font: 800 21px/1.1 var(--font-display);
    font-variant-numeric: tabular-nums;

    small {
      margin-left: 3px;
      color: var(--color-muted);
      font: 700 11px var(--font-display);
    }
  }

  .tile > .label,
  .tile > .detail {
    color: var(--color-muted);
    font: italic 500 13.5px/1.3 var(--font-label);
  }

  .tile > .detail {
    font-size: 13px;
  }
</style>
