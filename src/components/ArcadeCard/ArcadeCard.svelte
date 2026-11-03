<script lang="ts">
  import type { ArcadeCardView } from '~/lib/arcade/arcade.ts';
  import GameIcon from '../GameIcon/GameIcon.svelte';
  import StatPips from '../StatPips/StatPips.svelte';

  interface Props {
    card: ArcadeCardView;
    /** The planner page the build link opens. */
    planner?: string;
  }

  const { card, planner = '/' }: Props = $props();
  const e = $derived(card.event);
  const titleId = $derived(`arcade-${e.id}`);
</script>

<article class={['arcade-card', e.lock !== null && '-locked']} style:--card={`#${e.colour}`} aria-labelledby={titleId}>
  <header class="head">
    <p class="where"><span class="planet">{e.planet}</span><span class="track">{e.track}</span></p>
    <ol class="medals" aria-label="Medal times">
      {#each card.medals as m (m.medal)}
        <li class={['medal', `-${m.medal.toLowerCase()}`]}><span class="_visually-hidden">{m.medal}: </span><span class="time">{m.time}</span></li>
      {/each}
    </ol>
    <p class="type">{card.type}{#if e.laps !== null}<span class="laps"> · {e.laps} {e.laps === 1 ? 'lap' : 'laps'}</span>{/if}</p>
    <h3 class="name" id={titleId}>{e.name}</h3>
    <p class="desc">{e.desc}</p>
    {#if e.lock !== null}<p class="lock"><svg class="padlock" viewBox="0 0 12 14" aria-hidden="true"><path d="M3 6V4a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.8" /><rect x="1" y="6" width="10" height="8" rx="1.5" fill="currentColor" /></svg>{e.lock}</p>{/if}
  </header>

  <div class="body">
    <p class="vehicle"><GameIcon name={card.vehicle.icon} size="md" /><span class="label">{card.vehicle.name}</span><span class="nostyle">No racer style</span></p>
    <ul class="stats">
      {#each card.stats as s (s.id)}
        <li class="stat"><GameIcon name={s.icon} size="sm" label={s.name} /><StatPips level={s.level} label={s.name} /></li>
      {/each}
    </ul>
    <dl class="speeds">
      <div class="speed"><dt>Top speed</dt><dd>{card.speed.top} <small>km/h</small></dd></div>
      <div class="speed"><dt>Afterburner</dt><dd>{card.speed.afterburner} <small>km/h</small></dd></div>
      <div class="speed"><dt>Ramjet</dt><dd>{#if card.speed.ramjet === null}None{:else}{card.speed.ramjet} <small>km/h</small>{/if}</dd></div>
    </dl>
    {#if card.parts.length || card.abilities.length}
      <ul class="kit" aria-label="Parts and abilities">
        {#each card.abilities as a, i (i)}
          <li class="item -ability" title={a.name}><GameIcon name={a.icon} size="sm" label={a.name} /></li>
        {/each}
        {#each card.parts as p, i (i)}
          <li class={['item', `-${p.rarity.toLowerCase()}`]} title={`${p.name} (${p.rarity})`}><GameIcon name={p.icon} size="sm" label={p.name} /></li>
        {/each}
      </ul>
    {:else}
      <p class="kit -empty">No parts or abilities</p>
    {/if}
    {#if e.authoredStats}<p class="note">This event sets the vehicle's handling itself, so the planner's numbers are a guide.</p>{/if}
    <a class="open" href={`${planner}#${card.code}`}>Open in the planner</a>
  </div>
</article>

<style lang="scss">
  // One Arcade event, after the game's event tiles: the event's own colour on top with its planet, medal times and
  // name; the vehicle's levels, speeds and kit underneath.
  .arcade-card {
    position: relative; // holds its visually hidden labels, so they can't stretch a scrolling row
    display: grid;
    grid-template-rows: auto 1fr;
    overflow: hidden;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-lg);
    background: var(--color-panel);
  }

  .arcade-card > .head {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-4);
    background: linear-gradient(rgb(0 0 0 / 18%), rgb(0 0 0 / 38%)), var(--card);
    color: var(--color-on-teal);

    p {
      margin: 0;
    }

    .where {
      display: flex;
      flex-wrap: wrap;
      gap: 0 var(--space-2);
      align-items: baseline;
      font: 700 12px/1.3 var(--font-display);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .track {
      font: italic 500 14px var(--font-label);
      letter-spacing: 0;
      text-transform: none;
      opacity: 0.85;
    }

    .medals {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin: var(--space-2) 0;
      padding: 0;
      list-style: none;
    }

    .type {
      font: 600 12px/1 var(--font-label);
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .laps {
      letter-spacing: 0.04em;
      text-transform: none;
    }

    .desc {
      font: italic 500 14px var(--font-label);
      opacity: 0.85;
    }

    .lock {
      display: flex;
      gap: var(--space-2);
      align-items: center;
      margin-top: var(--space-2);
      font: italic 600 14px/1.3 var(--font-label);
    }

    .padlock {
      flex: none;
      width: 12px;
      height: 14px;
    }
  }

  .head > .name {
    color: inherit;
    font-size: 22px;
    font-weight: 900;
    line-height: 1.05;
    text-transform: uppercase;
  }

  // medal times: a coloured disc in the medal's metal, then the time
  .medals > .medal {
    display: flex;
    gap: 6px;
    align-items: center;
    font: 800 15px/1 var(--font-display);
    font-variant-numeric: tabular-nums;

    &::before {
      width: 12px;
      height: 12px;
      border: 2px solid rgb(0 0 0 / 35%);
      border-radius: 50%;
      background: var(--medal);
      content: '';
    }

    &.-gold { --medal: var(--color-rarity-legendary); }
    &.-silver { --medal: var(--color-rarity-epic); }
    &.-bronze { --medal: var(--color-rarity-rare); }
  }

  .arcade-card > .body {
    display: grid;
    gap: var(--space-3);
    align-content: start;
    padding: var(--space-4);

    p {
      margin: 0;
    }

    .vehicle {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      align-items: center;
    }

    .label {
      font: 800 14px/1 var(--font-display);
      text-transform: uppercase;
    }

    .nostyle {
      color: var(--color-muted);
      font: italic 500 13px var(--font-label);
    }

    .stats {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .stat {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: var(--space-2);
      align-items: center;
    }

    .speeds {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-2);
      margin: 0;
    }

    .speed {
      display: grid;
      gap: 2px;
    }

    dt {
      color: var(--color-muted);
      font: 600 11px/1.2 var(--font-label);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    dd {
      margin: 0;
      font: 800 16px/1.1 var(--font-display);
      font-variant-numeric: tabular-nums;
    }

    small {
      color: var(--color-muted);
      font: 500 11px var(--font-label);
    }

    .note {
      color: var(--color-muted);
      font: italic 500 13px/1.3 var(--font-label);
    }

    .open {
      justify-self: start;
      padding: 8px 14px;
      border-radius: var(--radius-pill);
      background: var(--color-accent);
      color: var(--color-on-accent);
      font: 800 12px/1 var(--font-display);
      letter-spacing: 0.03em;
      text-decoration: none;
      text-transform: uppercase;
    }

    .open:hover {
      filter: brightness(1.08);
    }
  }

  // abilities in teal, parts ringed in their rarity's colour
  .body > .kit {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;

    &.-empty {
      color: var(--color-muted);
      font: italic 500 13px var(--font-label);
    }

    .item {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border: 2px solid var(--ring, var(--color-line));
      border-radius: 50%;
      background: var(--color-teal);
      color: var(--color-on-teal);
    }

    .item.-common { --ring: var(--color-rarity-common); }
    .item.-rare { --ring: var(--color-rarity-rare); }
    .item.-epic { --ring: var(--color-rarity-epic); }
    .item.-legendary { --ring: var(--color-rarity-legendary); }
    .item.-faulty { --ring: var(--color-down); }
    .item.-ability { border-radius: var(--radius-md); }
  }
</style>
