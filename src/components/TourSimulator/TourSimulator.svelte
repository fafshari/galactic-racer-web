<script lang="ts">
  // The Multiplayer Tour simulator (ADR 0012): the run on the left, your racer beside it.
  // The simulation lives in src/lib/tour; this component holds the run and shows it.
  import { onMount } from 'svelte';
  import { planner } from '~/lib/data/index.ts';
  import { encodeBuild, evaluate, speeds, toKmh } from '~/lib/engine/index.ts';
  import { createSynergy } from '~/lib/synergy/synergy.ts';
  import { restoreTour, saveTour, TOUR_STORAGE_KEY } from '~/lib/tour/storage.ts';
  import { buildOf, credits, formRank, isFinalRace, isUnderdog, newTour, partTier, standings, totalXp, tourAction, type TourAction, type TourState } from '~/lib/tour/tour.ts';
  import Button from '../Button/Button.svelte';
  import GameIcon from '../GameIcon/GameIcon.svelte';
  import Panel from '../Panel/Panel.svelte';
  import StatRow from '../StatRow/StatRow.svelte';
  import Tag from '../Tag/Tag.svelte';
  import TourStage from './TourStage.svelte';
  import TourTrack from './TourTrack.svelte';

  const synergy = createSynergy(planner);
  let tour = $state<TourState>(newTour(planner, 1));
  let loaded = $state(false);
  let status = $state('');
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  const build = $derived(buildOf(tour));
  const result = $derived(evaluate(planner, build));
  const topSpeed = $derived(Math.round(toKmh(speeds(planner, build, result).top)));
  const running = $derived(tour.phase !== 'setup');
  const rank = $derived(formRank(tour));
  const focus = $derived(synergy.focus({ style: tour.style, abilities: tour.abilities, parts: tour.parts, levels: {} }));
  const field = $derived(running ? standings(planner, tour) : []);
  const vehicle = $derived(planner.vehicles.find((v) => v.id === tour.vehicle));
  const style = $derived(planner.styles.find((s) => s.id === tour.style));
  const ordinal = (n: number): string => `${String(n)}${['st', 'nd', 'rd'][n - 1] ?? 'th'}`;

  function act(a: TourAction): void {
    // the simulation clones its input; Svelte's state proxy can't be cloned, so hand it a plain snapshot
    const r = tourAction(planner, $state.snapshot(tour), a);
    tour = r.state;
    if (r.message) say(r.message);
  }
  function say(message: string): void {
    status = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => (status = ''), 4000);
  }

  onMount(() => {
    let saved: TourState | null = null;
    try {
      saved = restoreTour(planner, JSON.parse(localStorage.getItem(TOUR_STORAGE_KEY) ?? 'null'));
    } catch {
      // storage blocked or unreadable: start fresh
    }
    tour = saved ?? newTour(planner, Math.floor(Math.random() * 1e9));
    loaded = true;
  });

  $effect(() => {
    const snapshot = saveTour(tour);
    if (!loaded) return;
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, snapshot);
    } catch {
      // the run still works, it just isn't remembered
    }
  });
</script>

<div class="tour-simulator">
  <div class="toolbar">
    <p class="status" role="status">{status}</p>
    <Button onclick={() => { act({ type: 'newRun', seed: Math.floor(Math.random() * 1e9) }); }}>New run</Button>
  </div>

  <div class="layout">
    <div class="main">
      <Panel title="Tour" {...running ? { count: `Seed ${String(tour.seed)}` } : {}}>
        <TourTrack planets={planner.tour.planets} current={tour.planet} phase={tour.phase} final={isFinalRace(planner, tour)} />
      </Panel>
      <Panel>
        <div aria-live="polite"><TourStage {tour} {synergy} {act} /></div>
      </Panel>
    </div>

    <aside class="side" aria-label="Your racer">
      <Panel title="Your racer">
        {#snippet actions()}<span class="summary">{vehicle?.name} · {style?.name}</span>{/snippet}
        <div class="purse">
          {#if running}
            <span class="number">{Math.round(tour.credits).toLocaleString('en-US')}</span><span class="unit">credits</span>
          {:else}
            <span class="caption">Start a tour to earn credits.</span>
          {/if}
        </div>
        <div class="tiles">
          <div class="tile"><span class="n">{result.power}</span><span class="l">Power rating / 60</span></div>
          <div class="tile"><span class="n">{topSpeed}</span><span class="l">Top speed (km/h)</span></div>
          <div class="tile"><span class="n">{tour.parts.length}</span><span class="l">Parts / {planner.meta.partSlots.max}</span></div>
          {#if running}
            <div class="tile">
              <span class="n">{rank.score}</span>
              <span class="l">Form · {ordinal(rank.place)} of 12{tour.planet > 0 && !isFinalRace(planner, tour) && isUnderdog(planner, tour) && tour.phase !== 'done' ? ' · Underdog' : ''}</span>
            </div>
            <div class="tile"><span class="n">{totalXp(tour.xp).toLocaleString('en-US')}</span><span class="l">Tour EXP</span></div>
          {/if}
        </div>
        <div class="focus">
          <h3 class="heading">Build focus</h3>
          <div class="chips">
            {#each focus as f (f.id)}<Tag variant="good">{f.label} {Math.round(f.share * 100)}%</Tag>{:else}<Tag>Balanced</Tag>{/each}
          </div>
        </div>
        <div class="stats">
          {#each planner.slots as s (s.id)}<StatRow icon={s.icon} name={s.name} level={tour.levels[s.id] ?? 0} />{/each}
        </div>
      </Panel>

      <Panel title="Abilities & parts" count={`${String(tour.abilities.length)}/${String(planner.meta.abilitySlots)} · ${String(tour.parts.length)}/${String(planner.meta.partSlots.max)}`}>
        <ul class="owned">
          {#each tour.abilities as id, i (id)}
            {@const a = planner.abilities.find((x) => x.id === id)}
            {#if a}
              <li class="item">
                <GameIcon name={a.icon} size="sm" /><span class="name">{a.name}</span><Tag>{a.level.replace('Level', 'Lv ')}</Tag>
                {#if running}<Button size="sm" variant="quiet" aria-label={`Remove ${a.name}`} onclick={() => { act({ type: 'removeAbility', index: i }); }}>Remove</Button>{/if}
              </li>
            {/if}
          {/each}
          {#each tour.parts as id, i (id)}
            {@const p = planner.affixes.find((x) => x.id === id)}
            {#if p}
              <li class={['item', `-${partTier(p).toLowerCase()}`]}>
                <GameIcon name={p.icon} size="sm" /><span class="name">{p.name}</span><Tag>{p.rarity}</Tag>
                {#if running}<Button size="sm" variant="quiet" aria-label={`Remove ${p.name}`} onclick={() => { act({ type: 'removePart', index: i }); }}>Remove</Button>{/if}
              </li>
            {/if}
          {:else}
            {#if !tour.abilities.length}<li class="empty">Nothing yet.</li>{/if}
          {/each}
        </ul>
        <a class="planner-link" href={`/#${encodeBuild(build)}`}>Open this build in the planner</a>
      </Panel>

      {#if running}
        <Panel title="Field standings" count="Ranked by form">
          <div class="scroll">
            <table class="standings">
              <thead><tr><th>Racer</th><th>Type</th><th>Finishes</th><th class="n">Form</th></tr></thead>
              <tbody>
                {#each field as r (r.name)}
                  <tr class={[r.you && '-you', r.underdog && '-underdog']}>
                    <td>{r.name}{#if r.underdog}<span class="dog"> · Underdog</span>{/if}</td>
                    <td>{r.tier}</td>
                    <td>{r.finishes.join(' ')}</td>
                    <td class="n">{r.form}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </Panel>
      {/if}

      <Panel title="Run log">
        <ol class="log">
          {#each tour.log as l, i (i)}
            <li class="entry">
              <span class="planet">Planet {l.planet}</span><span class="text">{l.text}</span>
              <span class={['amount', l.amount > 0 && '-up', l.amount < 0 && '-down']}>{l.amount ? `${l.amount > 0 ? '+' : '−'}${credits(Math.abs(l.amount)).replace(' cr', '')}` : ''}</span>
            </li>
          {:else}
            <li class="empty">The run log fills in as you race.</li>
          {/each}
        </ol>
      </Panel>
    </aside>
  </div>
</div>

<style lang="scss">
  @use '../../styles/breakpoints' as bp;

  .tour-simulator {
    display: grid;
    gap: var(--space-4);
  }

  .tour-simulator > .toolbar {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    justify-content: flex-end;

    .status {
      flex: 1;
      margin: 0;
      color: var(--color-up);
      font: italic 500 14px var(--font-label);
    }
  }

  .tour-simulator > .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    gap: var(--space-4);
    align-items: start;

    @include bp.narrow {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .layout > .main,
  .layout > .side {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }

  .summary {
    color: var(--color-muted);
    font: italic 500 14px var(--font-label);
  }

  // credits as the planner's top-speed poster card
  .purse {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    align-items: baseline;
    padding: 14px 16px 14px 30px;
    border-radius: var(--radius-md);
    background: linear-gradient(90deg, var(--color-accent) 0 9px, var(--color-mustard) 9px 16px, var(--color-teal) 16px);
    color: var(--color-on-teal);

    .number {
      font: 900 34px/1 var(--font-display);
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
    }

    .unit,
    .caption {
      font: italic 500 15px var(--font-label);
      opacity: 0.85;
    }
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);

    .tile {
      display: grid;
      gap: 3px;
      padding: 10px 12px;
      border-top: 3px solid var(--color-mustard);
      border-radius: var(--radius-md);
      background: var(--color-sunk);
    }

    .n {
      font: 800 19px/1.1 var(--font-display);
      font-variant-numeric: tabular-nums;
    }

    .l {
      color: var(--color-muted);
      font: italic 500 13.5px/1.3 var(--font-label);
    }
  }

  .focus {
    display: grid;
    gap: var(--space-2);

    .heading {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.05em;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
  }

  .stats {
    display: grid;
    gap: 6px;
  }

  .owned {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;

    .item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      gap: var(--space-2);
      align-items: center;
      padding: 6px 8px;
      border-left: 4px solid var(--color-line);
      border-radius: var(--radius-md);
      background: var(--color-sunk);
      font-size: 13.5px;

      &.-common { border-left-color: var(--color-rarity-common); }
      &.-rare { border-left-color: var(--color-rarity-rare); }
      &.-epic { border-left-color: var(--color-rarity-epic); }
      &.-legendary { border-left-color: var(--color-rarity-legendary); }
    }

    .name {
      overflow-wrap: break-word;
    }
  }

  .empty {
    color: var(--color-muted);
    font-size: 13.5px;
    list-style: none;
  }

  .planner-link {
    font: italic 600 15px var(--font-label);
  }

  .scroll {
    overflow-x: auto;
  }

  .standings {
    width: 100%;
    border-collapse: collapse;
    font: 12.5px/1.4 var(--font-mono);
    font-variant-numeric: tabular-nums;

    th,
    td {
      padding: 4px 6px;
      border-top: 1px solid var(--color-line);
      text-align: left;
    }

    th {
      border-top: 0;
      color: var(--color-muted);
      font-weight: 500;
    }

    .n {
      text-align: right;
    }

    tr.-you td {
      color: var(--color-accent);
      font-weight: 600;
    }

    .dog {
      color: var(--color-cond);
    }
  }

  .log {
    display: grid;
    gap: 4px;
    max-height: 240px;
    margin: 0;
    padding: 0;
    overflow: auto;
    font: 12.5px/1.45 var(--font-mono);
    list-style: none;

    .entry {
      display: grid;
      grid-template-columns: 5.5em minmax(0, 1fr) auto;
      gap: var(--space-2);
    }

    .planet {
      color: var(--color-muted);
    }

    .amount.-up {
      color: var(--color-up);
    }

    .amount.-down {
      color: var(--color-down);
    }
  }
</style>
