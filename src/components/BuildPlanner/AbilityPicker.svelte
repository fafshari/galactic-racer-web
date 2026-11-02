<script lang="ts">
  import { planner } from '~/lib/data/index.ts';
  import type { Ability, AbilityId } from '~/lib/data/types.ts';
  import type { Build } from '~/lib/engine/build.ts';
  import { abilityChoices, type AbilitySlotKind } from '~/lib/planner/actions.ts';
  import ChoiceCard from '../ChoiceCard/ChoiceCard.svelte';
  import ModeSwitch from '../ModeSwitch/ModeSwitch.svelte';
  import SearchField from '../SearchField/SearchField.svelte';

  interface Props {
    build: Build;
    /** Regular slots offer regular abilities; the crash slot offers crash abilities. */
    slot: AbilitySlotKind;
    onpick: (id: AbilityId) => void;
  }

  type LevelFilter = Ability['level'] | 'all';
  const LEVELS: readonly { value: LevelFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'Level1', label: 'Lv 1' },
    { value: 'Level2', label: 'Lv 2' },
    { value: 'Level3', label: 'Lv 3' },
  ];

  const { build, slot, onpick }: Props = $props();
  let query = $state('');
  let level = $state<LevelFilter>('all');
  const choices = $derived(abilityChoices(planner, build.mode, slot, level, query));
</script>

<div class="ability-picker">
  <SearchField value={query} label="Search abilities" placeholder="Search abilities…" oninput={(v: string) => (query = v)} autofocus />
  <ModeSwitch label="Ability level" options={LEVELS} value={level} onchange={(v: LevelFilter) => (level = v)} />
  <div class="list">
    {#each choices as a (a.id)}
      {@const owned = build.abilities.includes(a.id)}
      <ChoiceCard
        icon={a.icon}
        title={a.name}
        note={owned ? 'In build' : a.level.replace('Level', 'Lv ')}
        subtitle={a.desc}
        pressed={owned}
        disabled={owned}
        onclick={() => { onpick(a.id); }}
      />
    {:else}
      <p class="empty">No abilities match. Try a shorter search.</p>
    {/each}
  </div>
</div>

<style lang="scss">
  .ability-picker {
    display: grid;
    gap: var(--space-3);
  }

  .ability-picker > .list {
    display: grid;
    gap: var(--space-2);
  }

  .list > .empty {
    color: var(--color-muted);
  }
</style>
