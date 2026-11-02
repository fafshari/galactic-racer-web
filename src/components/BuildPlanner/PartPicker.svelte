<script lang="ts">
  import { planner } from '~/lib/data/index.ts';
  import type { OfferRarity, Part, PartId } from '~/lib/data/types.ts';
  import type { Build } from '~/lib/engine/build.ts';
  import { cannotAddPart, familyKey, familyName, isSituational, offerRarity, partFamilies } from '~/lib/planner/actions.ts';
  import Button from '../Button/Button.svelte';
  import PartCard from '../PartCard/PartCard.svelte';
  import RarityToggle from '../RarityToggle/RarityToggle.svelte';
  import SearchField from '../SearchField/SearchField.svelte';

  interface Props {
    build: Build;
    onadd: (id: PartId) => void;
  }

  const { build, onadd }: Props = $props();
  let query = $state('');
  /** Which rarity each family's card shows, by family key. */
  let shown = $state<Record<string, PartId>>({});
  const families = $derived(partFamilies(planner, build.mode, query));

  /** A family's first member; families from partFamilies are never empty. */
  const lead = (fam: Part[]): Part => {
    const [p] = fam;
    if (!p) throw new Error('empty part family');
    return p;
  };
  const current = (fam: Part[]): Part => fam.find((p) => p.id === shown[familyKey(p)]) ?? lead(fam);
  const rarities = (fam: Part[]): OfferRarity[] => fam.map(offerRarity).filter((r) => r !== null);
  const show = (fam: Part[], r: OfferRarity): void => {
    const p = fam.find((x) => x.rarity === r);
    if (p) shown = { ...shown, [familyKey(p)]: p.id };
  };
  const blocked = { 'in-build': 'In build', full: 'Slots full' } as const;
</script>

<div class="part-picker">
  <SearchField value={query} label="Search parts" placeholder="Search parts by name or effect…" oninput={(v: string) => (query = v)} autofocus />
  <p class="count" aria-live="polite">{families.length} {families.length === 1 ? 'part' : 'parts'}</p>
  <div class="cards">
    {#each families as fam (familyKey(lead(fam)))}
      {@const p = current(fam)}
      {@const why = cannotAddPart(planner, build, p)}
      {@const r = offerRarity(p)}
      <PartCard part={p} name={familyName(planner, p)} situational={isSituational(p)} disabled={why !== null} onselect={() => { onadd(p.id); }}>
        {#snippet footer()}
          {#if r && fam.length > 1}<RarityToggle value={r} available={rarities(fam)} onchange={(x: OfferRarity) => { show(fam, x); }} label={`${familyName(planner, p)} rarity`} />{/if}
          <Button size="sm" disabled={why !== null} onclick={() => { onadd(p.id); }}>{why ? blocked[why] : 'Add'}</Button>
        {/snippet}
      </PartCard>
    {:else}
      <p class="empty">No parts match. Try a shorter search.</p>
    {/each}
  </div>
</div>

<style lang="scss">
  .part-picker {
    display: grid;
    gap: var(--space-3);
  }

  .part-picker > .count {
    margin: 0;
    color: var(--color-muted);
    font: italic 500 13.5px var(--font-label);
  }

  .part-picker > .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    grid-auto-rows: max-content;
    gap: 10px;
  }

  .cards > .empty {
    grid-column: 1 / -1;
    color: var(--color-muted);
  }
</style>
