<script lang="ts">
  import type { Phase } from '~/lib/tour/tour.ts';

  interface Props {
    planets: readonly { id: string; name: string }[];
    current: number;
    phase: Phase;
    /** The final race has only a bet and the race itself. */
    final?: boolean;
  }

  const STEPS = [
    { phase: 'backer', label: 'Backer' },
    { phase: 'bet', label: 'Bet' },
    { phase: 'race', label: 'Race' },
    { phase: 'rewards', label: 'Rewards' },
    { phase: 'shop', label: 'Shop' },
  ] as const;

  const { planets, current, phase, final = false }: Props = $props();
  const steps = $derived(final ? STEPS.filter((s) => s.phase === 'bet' || s.phase === 'race') : STEPS);
  const running = $derived(phase !== 'setup' && phase !== 'done');
</script>

<div class="tour-track">
  <ol class="stops">
    {#each planets as p, i (p.id)}
      {@const done = phase === 'done' || (phase !== 'setup' && i < current)}
      {@const now = running && i === current}
      <li class={['stop', done && '-done', now && '-now']} aria-current={now ? 'step' : undefined}>
        <span class="name">{p.name}</span>
        <span class="number">Planet {i + 1}</span>
      </li>
    {/each}
  </ol>
  {#if running}
    <ol class="steps" aria-label="This planet">
      {#each steps as s (s.phase)}
        <li class={['step', phase === s.phase && '-now']} aria-current={phase === s.phase ? 'step' : undefined}>{s.label}</li>
      {/each}
    </ol>
  {/if}
</div>

<style lang="scss">
  @use '../../styles/breakpoints' as bp;

  .tour-track {
    display: grid;
    gap: var(--space-3);
  }

  .tour-track > .stops {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;

    @include bp.narrow {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .stops > .stop {
    display: grid;
    gap: 3px;
    min-width: 0;
    padding: 8px;
    border-top: 4px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-sunk);

    &.-done {
      border-top-color: var(--color-up);

      .name {
        color: var(--color-muted);
      }
    }

    &.-now {
      border-top-color: var(--color-accent);
      background: var(--color-accent-soft);
    }

    .name {
      font: 700 15px/1.15 var(--font-label);
      overflow-wrap: anywhere;
    }

    .number {
      color: var(--color-muted);
      font: italic 500 13px/1.2 var(--font-label);
    }
  }

  .tour-track > .steps {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .steps > .step {
    padding: 5px 8px;
    border-radius: var(--radius-pill);
    background: var(--color-sunk);
    color: var(--color-muted);
    font: 700 12px/1 var(--font-label);
    letter-spacing: 0.06em;
    text-transform: uppercase;

    &.-now {
      background: var(--color-accent);
      color: var(--color-on-accent);
    }
  }
</style>
