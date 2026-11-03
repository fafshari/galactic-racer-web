<script lang="ts">
  import { BOOST_ICONS, type FavoriteSummary } from '~/lib/planner/favorites.ts';
  import GameIcon from '../GameIcon/GameIcon.svelte';

  interface Props {
    name: string;
    summary: FavoriteSummary;
    /** Loads the build. */
    onopen: () => void;
    onrename: (name: string) => void;
    onremove: () => void;
    /** Copies the build's link; resolves false when the clipboard is blocked. */
    oncopy: () => Promise<boolean>;
  }

  const { name, summary, onopen, onrename, onremove, oncopy }: Props = $props();
  let copied = $state<'idle' | 'done' | 'failed'>('idle');
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  async function copy(): Promise<void> {
    copied = (await oncopy()) ? 'done' : 'failed';
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copied = 'idle'), 2500);
  }
  let editing = $state(false);
  let draft = $state('');
  // the diamond's four places, in slot order: top, left, right, bottom
  const SPOTS = ['-top', '-left', '-right', '-bottom'] as const;
  const boostName = $derived(summary.boost.kind === 'ramjet' ? 'Ramjet' : 'Afterburner');

  function startEdit(): void {
    draft = name;
    editing = true;
  }

  function finish(save: boolean): void {
    if (save) onrename(draft);
    editing = false;
  }
</script>

<div class={['favorite-row', editing && '-editing']}>
  {#if editing}
    <form class="rename" onsubmit={(e) => { e.preventDefault(); finish(true); }}>
      <!-- svelte-ignore a11y_autofocus -->
      <input class="field" bind:value={draft} aria-label="Favourite name" maxlength="60" autofocus onkeydown={(e) => { if (e.key === 'Escape') finish(false); }} onblur={() => { finish(true); }} />
    </form>
  {:else}
    <!-- the whole card loads the build: this button's hit area stretches over it -->
    <button type="button" class="open" onclick={onopen} aria-label={`Load ${name}`}><span class="name">{name}</span></button>
  {/if}

  <span class="tools">
    {#if copied !== 'idle'}<span class="note" role="status">{copied === 'done' ? 'Copied' : "Couldn't copy"}</span>{/if}
    <button type="button" class="tool" aria-label={`Copy link to ${name}`} title="Copy link" onclick={() => { void copy(); }}>
      <svg class="glyph" viewBox="0 0 20 20" aria-hidden="true"><path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1M11.5 8.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
    </button>
    {#if !editing}<button type="button" class="tool" aria-label={`Rename ${name}`} title="Rename" onclick={startEdit}>✎</button>{/if}
    <button type="button" class="tool" aria-label={`Remove ${name}`} title="Remove" onclick={onremove}>×</button>
  </span>

  <span class="icons">
    <span class="badge" title={summary.vehicle.name}><GameIcon name={summary.vehicle.icon} size="md" label={summary.vehicle.name} /></span>
    {#if summary.style}
      <span class="badge" title={summary.style.name}><GameIcon name={summary.style.icon} size="md" label={summary.style.name} /></span>
    {:else}
      <span class="badge -empty" role="img" title="No racer style" aria-label="No racer style"></span>
    {/if}
    <span class="diamond" role="img" aria-label={summary.abilities.length ? `Abilities: ${summary.abilities.map((a) => a.name).join(', ')}` : 'No abilities'}>
      {#each SPOTS as spot, i (spot)}
        {@const a = summary.abilities[i]}
        <span class={['spot', spot, !a && '-empty']} title={a?.name}>{#if a}<GameIcon name={a.icon} size="sm" />{/if}</span>
      {/each}
    </span>
  </span>

  <span class="speed" title={`Top speed with ${boostName}, every on/off situational effect triggered`}>
    <GameIcon name={BOOST_ICONS[summary.boost.kind]} size="sm" label={boostName} />
    <span class="number">{summary.boost.kmh}</span><small class="unit">km/h</small>
  </span>
</div>

<style lang="scss">
  // One saved build as a card: its name and tools on top; vehicle, style and the four abilities in a diamond below,
  // with the best boost speed at the right like a readout. Clicking anywhere on the card loads the build.
  .favorite-row {
    position: relative;
    display: grid;
    grid-template-areas:
      'name tools'
      'icons speed';
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px var(--space-3);
    align-items: center;
    padding: 8px 10px 10px 12px;
    border: 1px solid var(--color-line);
    border-left: 4px solid var(--color-teal);
    border-radius: var(--radius-md);
    background: var(--color-panel);

    &:has(> .open:hover) {
      border-color: var(--color-accent);
    }

    > .open,
    > .rename { grid-area: name; }
    > .tools { grid-area: tools; }
    > .icons { grid-area: icons; }
    > .speed { grid-area: speed; }
  }

  .favorite-row > .open {
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-fg);
    font: 600 15px/1.3 var(--font-body);
    text-align: left;
    cursor: pointer;

    // the click target covers the whole card; the tools sit above it
    &::after {
      position: absolute;
      inset: 0;
      content: '';
    }

    &:focus-visible {
      outline: none;
    }

    &:focus-visible::after {
      border-radius: var(--radius-md);
      outline: 2px solid var(--color-accent);
    }
  }

  .open > .name {
    display: block;
    overflow-wrap: anywhere;
  }

  .favorite-row > .rename {
    min-width: 0;

    .field {
      width: 100%;
      padding: 3px 6px;
      border: 1px solid var(--color-accent);
      border-radius: 4px;
      background: var(--color-panel);
      color: var(--color-fg);
      font: 600 15px var(--font-body);
    }
  }

  .favorite-row > .tools {
    position: relative; // above the card's click area
    display: flex;
    gap: 2px;
    align-items: center;
    justify-self: end;

    .note {
      margin-right: 4px;
      color: var(--color-muted);
      font: italic 500 12.5px var(--font-label);
    }

    .tool {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: var(--color-muted);
      font-size: 16px;
      cursor: pointer;

      &:hover {
        background: var(--color-sunk);
        color: var(--color-fg);
      }
    }

    .glyph {
      width: 16px;
      height: 16px;
    }
  }

  .favorite-row > .icons {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .icons > .badge {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--color-teal);
    color: var(--color-on-teal);
  }

  // four small badges in a diamond: top, left, right, bottom. Placed exactly, with a small gap between neighbours
  // (badge 20px; the 52px box puts diagonal neighbours' centres 22.6px apart).
  .icons > .diamond {
    position: relative;
    flex: none;
    width: 52px;
    height: 52px;
    margin-left: 2px;

    .spot {
      position: absolute;
      display: grid;
      place-items: center;
      width: 20px;
      height: 20px;
      overflow: hidden;
      border-radius: 50%;
      background: var(--color-teal);
      color: var(--color-on-teal);
    }

    .spot.-top { top: 0; left: 16px; }
    .spot.-left { top: 16px; left: 0; }
    .spot.-right { top: 16px; left: 32px; }
    .spot.-bottom { top: 32px; left: 16px; }

    .spot.-empty {
      border: 1.5px dashed var(--color-line);
      background: transparent;
    }

    // the game's ability art fills its badge edge to edge; shrink it a touch inside the small circle
    .spot > :global(.game-icon) {
      width: 15px;
      height: 15px;
    }
  }

  .favorite-row > .speed {
    display: flex;
    gap: 5px;
    align-items: baseline;
    justify-self: end;
    white-space: nowrap;

    .number {
      font: 800 22px/1 var(--font-display);
      font-variant-numeric: tabular-nums;
    }

    .unit {
      color: var(--color-muted);
      font: 700 11px var(--font-display);
    }
  }
</style>
