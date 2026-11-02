<script lang="ts">
  // Every component, in every variant, fed with real game data (ADR 0006). Development only.
  import AbilitySlot from '~/components/AbilitySlot/AbilitySlot.svelte';
  import Button from '~/components/Button/Button.svelte';
  import ChangeRow from '~/components/ChangeRow/ChangeRow.svelte';
  import ChoiceCard from '~/components/ChoiceCard/ChoiceCard.svelte';
  import Drawer from '~/components/Drawer/Drawer.svelte';
  import GameIcon from '~/components/GameIcon/GameIcon.svelte';
  import InfoTip from '~/components/InfoTip/InfoTip.svelte';
  import KeywordText from '~/components/KeywordText/KeywordText.svelte';
  import FavourRow from '~/components/FavourRow/FavourRow.svelte';
  import ModeSwitch from '~/components/ModeSwitch/ModeSwitch.svelte';
  import Panel from '~/components/Panel/Panel.svelte';
  import PartCard from '~/components/PartCard/PartCard.svelte';
  import PartRow from '~/components/PartRow/PartRow.svelte';
  import RarityToggle from '~/components/RarityToggle/RarityToggle.svelte';
  import SearchField from '~/components/SearchField/SearchField.svelte';
  import SituationalEffect from '~/components/SituationalEffect/SituationalEffect.svelte';
  import SpeedPanel from '~/components/SpeedPanel/SpeedPanel.svelte';
  import StatPips from '~/components/StatPips/StatPips.svelte';
  import StatRow from '~/components/StatRow/StatRow.svelte';
  import StylePanel from '~/components/StylePanel/StylePanel.svelte';
  import Tag from '~/components/Tag/Tag.svelte';
  import ThemeSwitch from '~/components/ThemeSwitch/ThemeSwitch.svelte';
  import { labels, planner } from '~/lib/data/index.ts';
  import type { GameMode, OfferRarity, Part, SlotId, VehicleId } from '~/lib/data/types.ts';
  import { decodeBuild, evaluate, speeds, type ActiveCount, type Build } from '~/lib/engine/index.ts';
  import { conditionText, describeRow } from '~/lib/format/format.ts';

  // demo buttons that need a handler but have nothing to do here
  const noop = (): void => undefined;

  let theme = $state<'light' | 'dark'>('light');
  let mode = $state<GameMode>('mp');

  // ---- a real build to feed the overview and readout components ---------------------------------
  const family = (name: string): Part[] => {
    const first = planner.affixes.find((p) => p.name.startsWith(name));
    return first ? planner.affixes.filter((p) => p.family !== null && p.family === first.family) : [];
  };
  const efficiency = family('Afterburner Efficiency');
  const landings = planner.affixes.find((p) => p.name === 'Calibrating Landings I');
  let partId = $state(efficiency[1]?.id);
  const base = decodeBuild('gr2-m106475806');
  let levels = $state<Partial<Record<SlotId, number>>>({ ...base.levels });
  let active = $state<Record<string, ActiveCount>>({});
  const build = $derived<Build>({
    ...base,
    levels,
    parts: [partId, landings?.id].filter((id) => id !== undefined),
    abilities: planner.styles.find((s) => s.id === base.style)?.abilities.slice() ?? [],
    active,
  });
  const result = $derived(evaluate(planner, build));
  const speedValues = $derived(speeds(planner, build, result));
  const style = $derived(planner.styles.find((s) => s.id === build.style));
  const traits = $derived((style?.traits ?? []).map((t) => planner.traits[t]).filter((t) => t !== undefined));
  const part = $derived(planner.affixes.find((p) => p.id === partId));
  const available = $derived(efficiency.map((p) => p.rarity).filter((r): r is OfferRarity => r !== 'Faulty'));
  const setRarity = (r: OfferRarity): void => {
    partId = efficiency.find((p) => p.rarity === r)?.id ?? partId;
  };
  const rowsByKind = $derived.by(() => {
    const views = result.rows.map((r) => describeRow(labels, r));
    const pick = (kind: string) => views.find((v) => v.display.kind === kind);
    return [pick('single'), pick('parts'), pick('curve')].filter((v) => v !== undefined);
  });

  // ---- drawer demo ---------------------------------------------------------------------------------
  let drawerOpen = $state(false);
  let query = $state('');
  const matches = $derived(
    planner.affixes.filter((p) => p.mp.length && p.rarity === 'Rare' && `${p.name} ${p.desc}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6),
  );
  let vehicle = $state<VehicleId>('Bike' as VehicleId);
</script>

<div class="showcase" data-theme={theme}>
  <div class="toolbar">
    <ModeSwitch label="Theme" options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} value={theme} onchange={(t: 'light' | 'dark') => (theme = t)} />
  </div>

  <section class="group" aria-labelledby="sc-basics">
    <h2 id="sc-basics" class="heading">Basics</h2>
    <article class="specimen">
      <h3 class="name">Button</h3>
      <div class="row">
        <Button>Default</Button><Button variant="primary">Copy build link</Button><Button variant="quiet">Quiet</Button>
        <Button size="sm">Small</Button><Button disabled>Disabled</Button>
      </div>
    </article>
    <article class="specimen">
      <h3 class="name">ModeSwitch</h3>
      <ModeSwitch label="Game mode" options={[{ value: 'mp', label: 'Multiplayer Tour' }, { value: 'campaign', label: 'Campaign' }]} value={mode} onchange={(m: GameMode) => (mode = m)} />
    </article>
    <article class="specimen">
      <h3 class="name">ThemeSwitch</h3>
      <p class="row"><ThemeSwitch /> Sets the whole site's theme (this page's Theme switch above overrides it inside the showcase).</p>
    </article>
    <article class="specimen">
      <h3 class="name">Tag</h3>
      <div class="row"><Tag>Common</Tag><Tag variant="cond">Situational</Tag><Tag variant="good">Best fit</Tag><Tag variant="neg">Faulty</Tag></div>
    </article>
    <article class="specimen">
      <h3 class="name">GameIcon</h3>
      <div class="row">
        {#each ['sm', 'md', 'lg', 'xl'] as const as size (size)}<GameIcon name={planner.slots[0]?.icon ?? null} {size} label="Cornering" />{/each}
        <GameIcon name={planner.vehicles[1]?.icon ?? null} size="xl" label="Speeder Bike" />
      </div>
    </article>
    <article class="specimen">
      <h3 class="name">KeywordText · InfoTip</h3>
      {#if part}<p class="row"><KeywordText text={part.desc} keywords={part.hl} /><InfoTip label="keywords"><p>The game sets mechanic names in its keyword style.</p></InfoTip></p>{/if}
    </article>
  </section>

  <section class="group" aria-labelledby="sc-overview">
    <h2 id="sc-overview" class="heading">Overview</h2>
    <article class="specimen">
      <h3 class="name">SpeedPanel</h3>
      <SpeedPanel speeds={speedValues} powerBonus={result.powerBonus} />
    </article>
    <article class="specimen">
      <h3 class="name">StatRow · StatPips</h3>
      <div class="stack">
        {#each planner.slots as s (s.id)}
          <StatRow icon={s.icon} name={s.name} part={s.part} level={levels[s.id] ?? 0} onchange={(n: number) => (levels = { ...levels, [s.id]: n })}>
            {#snippet tip()}<p>Each level adds 1 to your power rating.</p>{/snippet}
          </StatRow>
        {/each}
        <div class="teal"><StatPips level={3} label="Boost" /></div>
      </div>
    </article>
    <article class="specimen">
      <h3 class="name">StylePanel</h3>
      {#if style}<StylePanel name={style.name} icon={style.icon} rank={style.rank} traits={traits} onchange={() => (drawerOpen = true)} />{/if}
    </article>
    <article class="specimen">
      <h3 class="name">AbilitySlot</h3>
      <div class="grid-2">
        <AbilitySlot ability={planner.abilities[0] ?? null} label="Ability 1" onselect={() => (drawerOpen = true)} onremove={noop} />
        <AbilitySlot ability={null} label="Ability 3" onselect={() => (drawerOpen = true)} />
      </div>
    </article>
    <article class="specimen">
      <h3 class="name">PartRow · RarityToggle</h3>
      <div class="stack">
        {#if part}
          <PartRow {part} onremove={noop}>
            {#snippet controls()}<RarityToggle value={part.rarity === 'Faulty' ? 'Common' : part.rarity} {available} onchange={setRarity} label="Afterburner Efficiency rarity" />{/snippet}
          </PartRow>
        {/if}
        {#if landings}<PartRow part={landings} situational />{/if}
      </div>
    </article>
  </section>

  <section class="group" aria-labelledby="sc-panels">
    <h2 id="sc-panels" class="heading">Panels</h2>
    <Panel title="Installed parts" count="1 / 10">
      {#snippet actions()}<Button size="sm" variant="primary">Add part</Button>{/snippet}
      {#if part}<PartRow {part} onremove={noop} />{/if}
    </Panel>
    <Panel title="Favours" count="2">
      <div class="stack">
        {#each planner.favours.filter((f) => f.negative).slice(0, 1).concat(planner.favours.filter((f) => !f.negative).slice(0, 1)) as f (f.id)}
          <FavourRow favour={f} onremove={noop} />
        {/each}
      </div>
    </Panel>
  </section>

  <section class="group" aria-labelledby="sc-pickers">
    <h2 id="sc-pickers" class="heading">Pickers</h2>
    <article class="specimen">
      <h3 class="name">Drawer · SearchField · PartCard</h3>
      <div class="row"><Button variant="primary" onclick={() => (drawerOpen = true)}>Add a part</Button></div>
    </article>
    <article class="specimen">
      <h3 class="name">PartCard</h3>
      <div class="cards">
        {#if part}
          <PartCard {part} name="Afterburner Efficiency" onselect={noop}>
            {#snippet footer()}<RarityToggle value={part.rarity === 'Faulty' ? 'Common' : part.rarity} {available} onchange={setRarity} />{/snippet}
          </PartCard>
        {/if}
        {#if landings}<PartCard part={landings} situational disabled onselect={noop}>{#snippet footer()}<span>In build</span>{/snippet}</PartCard>{/if}
      </div>
    </article>
    <article class="specimen">
      <h3 class="name">ChoiceCard</h3>
      <div class="grid-2">
        {#each planner.vehicles as v (v.id)}
          <ChoiceCard icon={v.icon} title={v.name} subtitle={v.traits.map((t) => t.name).join(' · ')} pressed={vehicle === v.id} onclick={() => (vehicle = v.id)} />
        {/each}
      </div>
    </article>
  </section>

  <section class="group" aria-labelledby="sc-readout">
    <h2 id="sc-readout" class="heading">Readout</h2>
    <article class="specimen">
      <h3 class="name">SituationalEffect</h3>
      <div class="stack">
        {#each result.conditionals.slice(0, 3) as c (c.key)}
          <SituationalEffect
            owner={c.owner}
            when={conditionText(c)}
            {...c.desc ? { desc: c.desc } : {}}
            repeatable={c.repeatable}
            {...c.perSecond ? { perSecond: c.perSecond } : {}}
            value={active[c.key]}
            onchange={(v: ActiveCount | undefined) => {
              const rest = Object.fromEntries(Object.entries(active).filter(([k]) => k !== c.key));
              active = v === undefined ? rest : { ...rest, [c.key]: v };
            }}
          />
        {/each}
      </div>
    </article>
    <article class="specimen">
      <h3 class="name">ChangeRow</h3>
      <div>
        {#each rowsByKind as view (view.label)}<ChangeRow {view} />{/each}
      </div>
    </article>
  </section>

  <Drawer open={drawerOpen} title="Add a part" onclose={() => (drawerOpen = false)}>
    <div class="stack">
      <SearchField value={query} label="Search parts" placeholder="Search parts by name or effect…" oninput={(v: string) => (query = v)} autofocus />
      <div class="cards">
        {#each matches as p (p.id)}
          <PartCard part={p} onselect={() => (drawerOpen = false)} />
        {/each}
      </div>
    </div>
  </Drawer>
</div>

<style lang="scss">
  .showcase {
    display: grid;
    gap: var(--space-5);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    color: var(--color-fg);
  }

  .showcase > .group {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
    gap: var(--space-4);
    align-items: start;
  }

  .group > .heading {
    grid-column: 1 / -1;
    font-size: 14px;
    font-weight: 900;
  }

  .specimen {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
    padding: var(--space-4);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-panel);
  }

  .specimen > .name {
    color: var(--color-muted);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    margin: 0;
  }

  .stack {
    display: grid;
    gap: var(--space-2);
  }

  .grid-2 {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
    gap: var(--space-2);
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
    gap: 10px;
  }

  .teal {
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--color-teal);
  }
</style>
