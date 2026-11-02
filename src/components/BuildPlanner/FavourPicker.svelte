<script lang="ts">
  import { planner } from '~/lib/data/index.ts';
  import type { FavourId } from '~/lib/data/types.ts';
  import type { Build } from '~/lib/engine/build.ts';
  import { isSituational } from '~/lib/planner/actions.ts';
  import Button from '../Button/Button.svelte';
  import FavourRow from '../FavourRow/FavourRow.svelte';
  import SearchField from '../SearchField/SearchField.svelte';

  interface Props {
    build: Build;
    onadd: (id: FavourId) => void;
  }

  const { build, onadd }: Props = $props();
  let query = $state('');
  const choices = $derived(planner.favours.filter((f) => !query.trim() || `${f.name} ${f.desc}`.toLowerCase().includes(query.trim().toLowerCase())));
  const ownedRank = (group: string): number | undefined => planner.favours.find((f) => f.group === group && build.favours.includes(f.id))?.rank;
</script>

<div class="favour-picker">
  <SearchField value={query} label="Search favours" placeholder="Search favours…" oninput={(v: string) => (query = v)} autofocus />
  <p class="note">One rank per favour: picking another rank replaces it. The game's favour limit isn't in the data, so none is enforced.</p>
  <div class="list">
    {#each choices as f (f.id)}
      {@const owned = build.favours.includes(f.id)}
      {@const other = ownedRank(f.group)}
      <FavourRow favour={f} situational={isSituational(f)} showUnlock>
        {#snippet controls()}
          <Button size="sm" disabled={owned} onclick={() => { onadd(f.id); }}>{owned ? 'In build' : other !== undefined ? `Replace rank ${String(other)}` : 'Add'}</Button>
        {/snippet}
      </FavourRow>
    {:else}
      <p class="empty">No favours match. Try a shorter search.</p>
    {/each}
  </div>
</div>

<style lang="scss">
  .favour-picker {
    display: grid;
    gap: var(--space-3);
  }

  .favour-picker > .note {
    margin: 0;
    color: var(--color-muted);
    font: italic 500 13.5px/1.35 var(--font-label);
  }

  .favour-picker > .list {
    display: grid;
    gap: var(--space-2);
  }

  .list > .empty {
    color: var(--color-muted);
  }
</style>
