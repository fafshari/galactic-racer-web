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
  const withAfterburner = $derived(kmh(speeds.top + speeds.afterburner));
  const withRamjet = $derived(kmh(speeds.top + speeds.ramjet));
  // The faster of the two boosts stands out. With an unknown Ramjet base its number is only a floor, so
  // Afterburner can't be called faster; a tie highlights neither.
  const faster = $derived<'afterburner' | 'ramjet' | null>(
    withRamjet > withAfterburner ? 'ramjet' : withAfterburner > withRamjet && speeds.ramjetKnown ? 'afterburner' : null,
  );
</script>

<div class="speed-panel">
  <div class="poster">
    <h3 class="heading">
      Top speed<InfoTip label="Top speed">
        <p>Your top speed with no boost active: the vehicle's base top speed ({kmh(speeds.baseTop)} km/h) plus everything in this build, including situational effects you've counted.</p>
        <p>Parts that increase Speed raise your Power rating, and each Power point adds top speed just like an upgrade level.{#if powerBonus} This build gets +{powerBonus} Power from Speed gains.{/if}</p>
        <p>Real races also depend on drag, terrain and handling, so treat this as the ceiling.</p>
      </InfoTip>
    </h3>
    <p class="reading"><span class="number">{top}</span><span class="unit">km/h</span></p>
  </div>
  <div class="boosts">
    <div class={['tile', faster === 'afterburner' && '-faster']}>
      <h3 class="heading">Afterburner{#if faster === 'afterburner'}<span class="_visually-hidden">, the faster boost</span>{/if}<InfoTip label="Afterburner"><p>Top speed plus the Afterburner's top-speed bonus (base 64.4 km/h, raised by Afterburner-power parts).</p></InfoTip></h3>
      <span class="number">{withAfterburner}<small>km/h</small></span>
      <span class="detail">+{kmh(speeds.afterburner)} km/h</span>
    </div>
    <div class={['tile', faster === 'ramjet' && '-faster']}>
      <h3 class="heading">Ramjet{#if faster === 'ramjet'}<span class="_visually-hidden">, the faster boost</span>{/if}<InfoTip label="Ramjet">
        <p>Top speed plus the Ramjet's top-speed bonus (base 128.7 km/h, raised by Boost upgrades and Ramjet-power parts).</p>
      </InfoTip></h3>
      <span class="number">{withRamjet}{#if !speeds.ramjetKnown}&nbsp;+ ?{/if}<small>km/h</small></span>
      <span class="detail">+{kmh(speeds.ramjet)} km/h{#if !speeds.ramjetKnown} · unknown base{/if}</span>
    </div>
    <div class="tile">
      <h3 class="heading">Surge<InfoTip label="Surge">
        <p>Read +{kmh(speeds.surge)}/{kmh(speeds.surgeBurst)} as sustained / burst.</p>
        <p>The first number is what Speed Surging adds on top of your top speed, for as long as you're Surging.</p>
        <p>The second is the burst: a short spike when Surging starts. It ramps in over 0.15 s, holds until 0.35 s and fades out by 1.4 s.</p>
      </InfoTip></h3>
      <span class="number">+{kmh(speeds.surge)}/{kmh(speeds.surgeBurst)}<small>km/h</small></span>
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
    display: grid;
    gap: 6px;
    padding: 12px 16px 14px 30px;
    border-radius: var(--radius-md);
    background: linear-gradient(90deg, var(--color-accent) 0 9px, var(--color-mustard) 9px 16px, var(--color-teal) 16px);
    color: var(--color-on-teal);
  }

  // the small caps heading on every card, like the panel titles
  .poster > .heading,
  .tile > .heading {
    display: flex;
    gap: 2px;
    align-items: center;
    margin: 0;
    font: 700 13.5px/1.2 var(--font-label); // condensed, so "Afterburner" fits a third of a narrow readout
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .poster > .heading {
    opacity: 0.85;
  }

  .tile > .heading {
    color: var(--color-muted);
  }

  .poster > .reading {
    display: flex;
    gap: 12px;
    align-items: baseline;
    margin: 0;
  }

  .reading > .number {
    font: 900 46px/1 var(--font-display);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .reading > .unit {
    font: 800 15px/1 var(--font-display);
    text-transform: uppercase;
    opacity: 0.8;
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
    align-content: start;
    padding: 10px 12px;
    border-top: 3px solid var(--color-mustard);
    border-radius: var(--radius-md);
    background: var(--color-sunk);

    // the faster of Afterburner and Ramjet: the poster's teal, with a rust edge
    &.-faster {
      border-top-color: var(--color-accent);
      background: var(--color-teal);
      color: var(--color-on-teal);
    }

    &.-faster > .heading,
    &.-faster > .detail,
    &.-faster small {
      color: inherit;
      opacity: 0.8;
    }
  }

  // the unit drops below the number when a narrow tile can't fit both ("+24/80 km/h")
  .tile > .number {
    display: flex;
    flex-wrap: wrap;
    column-gap: 3px;
    align-items: baseline;
    font: 800 21px/1.1 var(--font-display);
    font-variant-numeric: tabular-nums;

    small {
      color: var(--color-muted);
      font: 700 11px var(--font-display);
    }
  }

  .tile > .heading + .number {
    margin-top: 2px;
  }

  .tile > .detail {
    color: var(--color-muted);
    font: italic 500 13px/1.3 var(--font-label);
  }
</style>
