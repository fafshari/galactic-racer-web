<script lang="ts">
  // The build planner (ADR 0012): the game's build overview, a readout beside it, and pickers in a drawer.
  // All rules live in src/lib/planner; this component holds the build and wires the pieces together.
  import { onMount } from 'svelte';
  import { iconUrl, labels, planner } from '~/lib/data/index.ts';
  import type { AbilityId, FavourId, GameMode, PartId, StyleId } from '~/lib/data/types.ts';
  import { decodeBuild, encodeBuild, evaluate, freshBuild, speeds, BuildCodeError, type ActiveCount, type Build } from '~/lib/engine/index.ts';
  import * as A from '~/lib/planner/actions.ts';
  import { changeGroups, slotImproves } from '~/lib/planner/readout.ts';
  import { restoreBuild, STORAGE_KEY } from '~/lib/planner/storage.ts';
  import AbilitySlot from '../AbilitySlot/AbilitySlot.svelte';
  import Button from '../Button/Button.svelte';
  import ChoiceCard from '../ChoiceCard/ChoiceCard.svelte';
  import Drawer from '../Drawer/Drawer.svelte';
  import FavourRow from '../FavourRow/FavourRow.svelte';
  import GameIcon from '../GameIcon/GameIcon.svelte';
  import ModeSwitch from '../ModeSwitch/ModeSwitch.svelte';
  import Panel from '../Panel/Panel.svelte';
  import PartRow from '../PartRow/PartRow.svelte';
  import RarityToggle from '../RarityToggle/RarityToggle.svelte';
  import StatRow from '../StatRow/StatRow.svelte';
  import StylePanel from '../StylePanel/StylePanel.svelte';
  import AbilityPicker from './AbilityPicker.svelte';
  import FavourPicker from './FavourPicker.svelte';
  import PartPicker from './PartPicker.svelte';
  import PlannerReadout from './PlannerReadout.svelte';

  type Picker = { kind: 'vehicle' } | { kind: 'style' } | { kind: 'ability'; slot: number } | { kind: 'part' } | { kind: 'favour' };
  const PICKER_TITLE: Record<Picker['kind'], string> = {
    vehicle: 'Choose a vehicle',
    style: 'Choose a racer style',
    ability: 'Choose an ability',
    part: 'Add a part',
    favour: 'Add a favour',
  };
  const MODES = (Object.entries(planner.meta.modes) as [GameMode, { name: string }][]).map(([value, m]) => ({ value, label: m.name }));

  let build = $state<Build>(freshBuild('mp'));
  let loaded = $state(false);
  let picker = $state<Picker | null>(null);
  let status = $state('');
  let codeInput = $state('');
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  const result = $derived(evaluate(planner, build));
  const speedValues = $derived(speeds(planner, build, result));
  const groups = $derived(changeGroups(planner, labels, build.vehicle, result));
  const vehicle = $derived(planner.vehicles.find((v) => v.id === build.vehicle));
  const style = $derived(planner.styles.find((s) => s.id === build.style));
  const traits = $derived((style?.traits ?? []).map((t) => planner.traits[t]).filter((t) => t !== undefined));
  const ranks = $derived(A.ranksOf(planner, build));
  const parts = $derived(build.parts.map((id) => planner.affixes.find((p) => p.id === id)).filter((p) => p !== undefined));
  const favours = $derived(build.favours.map((id) => planner.favours.find((f) => f.id === id)).filter((f) => f !== undefined));
  const power = $derived(A.powerOf(planner, build));
  const vehicleArt = $derived(vehicle?.art ? iconUrl(vehicle.art) : undefined);

  function update(next: Build): void {
    build = next;
  }
  function pick(next: Build): void {
    build = next;
    picker = null; // the drawer closes after every selection (ADR 0012)
  }
  function say(message: string): void {
    status = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => (status = ''), 4000);
  }
  function loadCode(code: string, from: string): void {
    try {
      build = decodeBuild(code);
      say(`Build loaded from ${from}.`);
    } catch (e) {
      say(e instanceof BuildCodeError ? e.message : "That build couldn't be loaded.");
    }
  }

  onMount(() => {
    // A build link wins; otherwise pick up where the visitor left off.
    if (location.hash.startsWith('#gr2-')) loadCode(location.hash.slice(1), 'the link');
    else {
      try {
        const saved = restoreBuild(planner, JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
        if (saved) build = saved;
      } catch {
        // storage blocked or unreadable: start fresh
      }
    }
    loaded = true;
    const onHash = (): void => {
      if (location.hash.startsWith('#gr2-')) loadCode(location.hash.slice(1), 'the link');
    };
    addEventListener('hashchange', onHash);
    return () => { removeEventListener('hashchange', onHash); };
  });

  $effect(() => {
    const snapshot = JSON.stringify(build);
    const code = encodeBuild(build);
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, snapshot);
    } catch {
      // private mode or storage full: the build still works, it just isn't remembered
    }
    // Once the build no longer matches the link it was opened from, drop the link from the address bar,
    // so a reload restores the latest build instead of the original link's.
    if (location.hash.startsWith('#gr2-') && location.hash.slice(1).replace(/\.+$/, '') !== code) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  });

  async function copyLink(): Promise<void> {
    const code = encodeBuild(build);
    history.replaceState(null, '', `#${code}`);
    codeInput = code;
    try {
      await navigator.clipboard.writeText(location.href);
      say('Build link copied. Anyone opening it gets this build.');
    } catch {
      say("Couldn't copy automatically: the code is in the box, select it and copy.");
    }
  }

  function newBuild(): void {
    build = freshBuild(build.mode);
    codeInput = '';
    history.replaceState(null, '', location.pathname);
    say('Started a new build.');
  }
</script>

<div class="build-planner">
  <div class="toolbar">
    <ModeSwitch label="Game mode" options={MODES} value={build.mode} onchange={(m: GameMode) => { update(A.setMode(planner, build, m)); }} />
    <div class="actions">
      <Button onclick={newBuild}>New build</Button>
      <Button variant="primary" onclick={copyLink}>Copy build link</Button>
    </div>
    <form class="load" onsubmit={(e) => { e.preventDefault(); loadCode(codeInput, 'the code'); }}>
      <input class="code" bind:value={codeInput} aria-label="Build code" placeholder="Paste a build code" autocomplete="off" spellcheck="false" />
      <Button type="submit" size="sm">Load</Button>
    </form>
    <p class="status" role="status">{status}</p>
  </div>

  <div class="layout">
    <div class="overview">
      <Panel title="Vehicle stats" count={`Power ${String(power)} / 60`}>
        {#snippet actions()}<Button size="sm" onclick={() => (picker = { kind: 'vehicle' })}>Change vehicle</Button>{/snippet}
        {#if vehicle}
          <div class="vehicle">
            <GameIcon name={vehicle.icon} size="xl" />
            <div class="vehicle-text">
              <span class="vehicle-name">{vehicle.name}</span>
              <span class="vehicle-traits">{vehicle.traits.map((t) => t.name).join(' · ')}</span>
            </div>
            {#if vehicleArt}<img class="vehicle-art" src={vehicleArt} alt="" width="160" height="120" />{/if}
          </div>
        {/if}
        <div class="stats">
          {#each planner.slots as s (s.id)}
            {@const improves = slotImproves(planner, labels, s, build.vehicle)}
            <StatRow icon={s.icon} name={s.name} part={s.part} level={build.levels[s.id] ?? 0} onchange={(n: number) => { update(A.setLevel(build, s.id, n)); }}>
              {#snippet tip()}
                <p>Each level adds 1 to your power rating{improves.length ? ' and improves:' : '.'}</p>
                {#if improves.length}<p>{improves.join(' · ')}</p>{/if}
              {/snippet}
            </StatRow>
          {/each}
        </div>
      </Panel>

      <div class="column">
        <Panel>
          {#if style}
            <StylePanel name={style.name} icon={style.icon} rank={style.rank} {traits} onchange={() => (picker = { kind: 'style' })} />
          {/if}
          {#if ranks.length > 1}
            <ModeSwitch label="Style rank" options={ranks.map((r) => ({ value: r.id, label: `Rank ${String(r.rank)}` }))} value={build.style} onchange={(id: StyleId) => { update(A.setRank(build, id)); }} />
          {/if}
        </Panel>

        <Panel title="Abilities" count={`${String(build.abilities.length)} / ${String(A.maxAbilities(planner))}`}>
          <div class="abilities">
            {#each Array.from({ length: A.maxAbilities(planner) }, (_, i) => i) as i (i)}
              {@const id = build.abilities[i]}
              <AbilitySlot
                ability={id === undefined ? null : (planner.abilities.find((a) => a.id === id) ?? null)}
                label={`Ability ${String(i + 1)}`}
                onselect={() => (picker = { kind: 'ability', slot: i })}
                {...id === undefined ? {} : { onremove: () => { update(A.removeAbility(build, i)); } }}
              />
            {/each}
          </div>
        </Panel>
      </div>

      <Panel title="Installed parts" count={`${String(parts.length)} / ${String(A.maxParts(planner))}`}>
        {#snippet actions()}
          <Button size="sm" variant="primary" disabled={parts.length >= A.maxParts(planner)} onclick={() => (picker = { kind: 'part' })}>Add part</Button>
        {/snippet}
        {#if parts.length}
          <div class="rows">
            {#each parts as p, i (p.id)}
              {@const family = A.familyOf(planner, p, build.mode)}
              {@const r = A.offerRarity(p)}
              <PartRow part={p} situational={A.isSituational(p)} onremove={() => { update(A.removePart(build, i)); }}>
                {#snippet controls()}
                  {#if r && family.length > 1}
                    <RarityToggle
                      value={r}
                      available={family.map(A.offerRarity).filter((x) => x !== null)}
                      label={`${A.familyName(planner, p)} rarity`}
                      onchange={(to) => {
                        const target = family.find((x) => x.rarity === to);
                        if (target) update(A.swapPart(planner, build, i, target.id));
                      }}
                    />
                  {/if}
                {/snippet}
              </PartRow>
            {/each}
          </div>
        {:else}
          <p class="empty">No parts yet. You start with {planner.meta.partSlots.start} slots unlocked and can fill up to {A.maxParts(planner)}.</p>
        {/if}
      </Panel>

      {#if build.mode === 'campaign'}
        <Panel title="Favours" count={String(favours.length)}>
          {#snippet actions()}<Button size="sm" onclick={() => (picker = { kind: 'favour' })}>Add favour</Button>{/snippet}
          {#if favours.length}
            <div class="rows">
              {#each favours as f, i (f.id)}
                <FavourRow favour={f} situational={A.isSituational(f)} onremove={() => { update(A.removeFavour(build, i)); }} />
              {/each}
            </div>
          {:else}
            <p class="empty">No favours yet.</p>
          {/if}
        </Panel>
      {/if}
    </div>

    <aside class="readout" aria-label="Build readout">
      <PlannerReadout
        {build}
        {result}
        speeds={speedValues}
        {groups}
        summary={`${vehicle?.name ?? ''} · ${style?.name ?? ''}`}
        onactive={(key: string, v: ActiveCount | undefined) => { update(A.setActive(build, key, v)); }}
      />
    </aside>
  </div>

  <Drawer open={picker !== null} title={picker ? PICKER_TITLE[picker.kind] : ''} onclose={() => (picker = null)}>
    {#if picker?.kind === 'vehicle'}
      <div class="choices">
        {#each planner.vehicles.filter((v) => planner.meta.modes[build.mode].vehicles.includes(v.id)) as v (v.id)}
          <ChoiceCard icon={v.icon} title={v.name} subtitle={v.traits.map((t) => t.name).join(' · ')} pressed={build.vehicle === v.id} onclick={() => { pick(A.setVehicle(build, v.id)); }} />
        {/each}
      </div>
    {:else if picker?.kind === 'style'}
      <div class="choices">
        {#each planner.styles.filter((s) => s.mode === build.mode && (s.rank ?? 1) === 1) as s (s.id)}
          <ChoiceCard
            icon={s.icon}
            title={s.name}
            subtitle={s.abilities.map((a) => planner.abilities.find((x) => x.id === a)?.name ?? a).join(', ')}
            pressed={style?.group === s.group}
            onclick={() => { pick(A.setStyle(planner, build, s.id)); }}
          />
        {/each}
      </div>
    {:else if picker?.kind === 'ability'}
      {@const slot = picker.slot}
      <AbilityPicker {build} onpick={(id: AbilityId) => { pick(A.placeAbility(planner, build, id, slot)); }} />
    {:else if picker?.kind === 'part'}
      <PartPicker {build} onadd={(id: PartId) => { pick(A.addPart(planner, build, id)); }} />
    {:else if picker?.kind === 'favour'}
      <FavourPicker {build} onadd={(id: FavourId) => { pick(A.addFavour(planner, build, id)); }} />
    {/if}
  </Drawer>
</div>

<style lang="scss">
  @use '../../styles/breakpoints' as bp;

  .build-planner {
    display: grid;
    gap: var(--space-4);
  }

  .build-planner > .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: center;
  }

  .toolbar > .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-left: auto;
  }

  .toolbar > .load {
    display: flex;
    gap: var(--space-2);

    .code {
      width: 13em;
      min-width: 0;
      padding: 6px 10px;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      background: var(--color-panel);
      color: var(--color-fg);
      font: 13px var(--font-mono);
    }
  }

  .toolbar > .status {
    flex-basis: 100%;
    min-height: 1.3em;
    margin: 0;
    color: var(--color-up);
    font: italic 500 14px var(--font-label);
  }

  // Overview on the left (the game's panels), readout on the right; one column on narrow screens.
  .build-planner > .layout {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1.15fr);
    gap: var(--space-4);
    align-items: start;

    @include bp.narrow {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .layout > .overview {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
    gap: var(--space-4);
    align-items: start;
  }

  .overview > .column {
    display: grid;
    gap: var(--space-4);
  }

  .layout > .readout {
    position: sticky;
    top: var(--space-3);
    max-height: calc(100dvh - var(--space-5));
    overflow: auto;

    @include bp.narrow {
      position: static;
      max-height: none;
    }
  }

  .vehicle {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space-1) var(--space-3);
    align-items: center;
  }

  .vehicle > .vehicle-text {
    display: grid;
    gap: 2px;
  }

  .vehicle-text > .vehicle-name {
    font: 900 18px/1.1 var(--font-display);
    text-transform: uppercase;
  }

  .vehicle-text > .vehicle-traits {
    color: var(--color-muted);
    font: italic 500 14px var(--font-label);
  }

  .vehicle > .vehicle-art {
    grid-column: 1 / -1;
    justify-self: center;
    width: min(100%, 220px);
    height: auto;
  }

  .stats,
  .rows,
  .choices {
    display: grid;
    gap: var(--space-2);
  }

  .abilities {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); // wide enough for a long ability name beside its badge
    gap: var(--space-2);
  }

  .empty {
    margin: 0;
    color: var(--color-muted);
    font-size: 13.5px;
  }
</style>
