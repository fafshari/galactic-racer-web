<script lang="ts">
  // The build planner (ADR 0012): the game's build overview, a readout beside it, and pickers in a drawer.
  // All rules live in src/lib/planner; this component holds the build and wires the pieces together.
  import { onMount } from 'svelte';
  import { iconUrl, labels, planner } from '~/lib/data/index.ts';
  import type { AbilityId, FavourId, GameMode, PartId, StyleId } from '~/lib/data/types.ts';
  import { decodeBuild, encodeBuild, evaluate, freshBuild, speeds, BuildCodeError, type ActiveCount, type Build } from '~/lib/engine/index.ts';
  import * as A from '~/lib/planner/actions.ts';
  import { abilityCooldowns, changeGroups, cooldownText, slotImproves } from '~/lib/planner/readout.ts';
  import { restoreBuild, STORAGE_KEY } from '~/lib/planner/storage.ts';
  import AbilitySlot from '../AbilitySlot/AbilitySlot.svelte';
  import Button from '../Button/Button.svelte';
  import ChoiceCard from '../ChoiceCard/ChoiceCard.svelte';
  import Drawer from '../Drawer/Drawer.svelte';
  import FavourRow from '../FavourRow/FavourRow.svelte';
  import GameIcon from '../GameIcon/GameIcon.svelte';
  import HoverTip from '../HoverTip/HoverTip.svelte';
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
  import ScreenshotImport from './ScreenshotImport.svelte';
  import FavoriteRow from '../FavoriteRow/FavoriteRow.svelte';
  import { addFavorite, defaultName, FAVORITES_KEY, isFavorite, removeFavorite, renameFavorite, restoreFavorites, saveFavorites, summarize, type Favorite } from '~/lib/planner/favorites.ts';

  type Picker = { kind: 'vehicle' } | { kind: 'style' } | { kind: 'ability'; slot: number | 'crash' } | { kind: 'part' } | { kind: 'favour' } | { kind: 'import' } | { kind: 'favorites' };
  const PICKER_TITLE: Record<Picker['kind'], string> = {
    vehicle: 'Choose a vehicle',
    style: 'Choose a racer style',
    ability: 'Choose an ability',
    part: 'Add a part',
    favour: 'Add a favour',
    import: 'Import from a screenshot',
    favorites: 'Favourites',
  };
  const MODES = (Object.entries(planner.meta.modes) as [GameMode, { name: string }][]).map(([value, m]) => ({ value, label: m.name }));

  let build = $state<Build>(freshBuild('mp'));
  let loaded = $state(false);
  let picker = $state<Picker | null>(null);
  let status = $state('');
  let codeInput = $state('');
  /** An image pasted or dropped onto the page, handed to the import drawer. */
  let screenshot = $state<Blob | null>(null);
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  /** Saved builds, newest first, kept in the browser (see lib/planner/favorites.ts). */
  let favorites = $state<Favorite[]>([]);
  const saved = $derived(isFavorite(favorites, build));

  const result = $derived(evaluate(planner, build));
  const speedValues = $derived(speeds(planner, build, result));
  const groups = $derived(changeGroups(planner, labels, build.vehicle, result));
  const vehicle = $derived(planner.vehicles.find((v) => v.id === build.vehicle));
  const style = $derived(planner.styles.find((s) => s.id === build.style));
  const traits = $derived((style?.traits ?? []).map((t) => planner.traits[t]).filter((t) => t !== undefined));
  const ranks = $derived(A.ranksOf(planner, build));
  const parts = $derived(build.parts.map((id) => planner.affixes.find((p) => p.id === id)).filter((p) => p !== undefined));
  const regular = $derived(A.regularAbilities(planner, build));
  const crash = $derived(A.crashAbility(planner, build));
  const cooldowns = $derived(abilityCooldowns(planner, build.abilities, result));
  const cooldownOf = (id: AbilityId | undefined): { cooldown?: string } => {
    const c = id === undefined ? undefined : cooldowns.get(id);
    return c ? { cooldown: cooldownText(c) } : {};
  };
  const abilityById = (id: AbilityId | undefined) => (id === undefined ? null : (planner.abilities.find((a) => a.id === id) ?? null));
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

  function saveFavorite(): void {
    if (saved) {
      say('This build is already in your favourites.');
      return;
    }
    favorites = addFavorite(planner, favorites, build, defaultName(planner, build), Date.now(), crypto.randomUUID());
    say('Saved to favourites. Open Favourites to rename it.');
  }

  onMount(() => {
    try {
      favorites = restoreFavorites(planner, JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? 'null'));
    } catch {
      // storage blocked or unreadable: no favourites yet
    }
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
    // Pasting an image anywhere on the page imports it; pasted text still goes wherever it was going.
    const onPaste = (e: ClipboardEvent): void => {
      const image = imageFrom(e.clipboardData);
      if (!image) return;
      e.preventDefault();
      importScreenshot(image);
    };
    addEventListener('hashchange', onHash);
    addEventListener('paste', onPaste);
    return () => {
      removeEventListener('hashchange', onHash);
      removeEventListener('paste', onPaste);
    };
  });

  $effect(() => {
    const snapshot = saveFavorites(favorites);
    if (!loaded) return;
    try {
      localStorage.setItem(FAVORITES_KEY, snapshot);
    } catch {
      // private mode or storage full: favourites last until the page closes
    }
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

  /** Copies text; false when the browser blocks the clipboard. */
  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

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

  function imageFrom(data: DataTransfer | null): File | null {
    return [...(data?.files ?? [])].find((f) => f.type.startsWith('image/')) ?? null;
  }

  function importScreenshot(image: Blob): void {
    screenshot = image;
    picker = { kind: 'import' };
  }

  function dropOnPage(e: DragEvent): void {
    const image = imageFrom(e.dataTransfer);
    if (!image) return;
    e.preventDefault();
    importScreenshot(image);
  }

  function newBuild(): void {
    build = freshBuild(build.mode);
    codeInput = '';
    history.replaceState(null, '', location.pathname);
    say('Started a new build.');
  }
</script>

<!-- Dropping an image anywhere on the planner imports it, like pasting; the toolbar button is the keyboard route. -->
<div
  class="build-planner"
  role="presentation"
  ondragover={(e) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); }}
  ondrop={dropOnPage}
>
  <div class="toolbar">
    <ModeSwitch label="Game mode" options={MODES} value={build.mode} onchange={(m: GameMode) => { update(A.setMode(planner, build, m)); }} />
    <div class="actions">
      <Button onclick={() => { screenshot = null; picker = { kind: 'import' }; }}>Import screenshot</Button>
      <Button onclick={newBuild}>New build</Button>
      <Button onclick={saveFavorite} aria-pressed={saved}>{saved ? '★ In favourites' : '☆ Save to favourites'}</Button>
      <Button onclick={() => (picker = { kind: 'favorites' })}>Favourites{favorites.length ? ` (${String(favorites.length)})` : ''}</Button>
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
      <div class="panels">
        <div class="stack -main">
          <Panel title="Vehicle stats" collapseKey="planner.vehicle" count={`Power ${String(power)} / 60`}>
            {#snippet actions()}<Button size="sm" onclick={() => (picker = { kind: 'vehicle' })}>Change vehicle</Button>{/snippet}
            {#if vehicle}
              <div class="vehicle">
                <GameIcon name={vehicle.icon} size="xl" />
                <div class="vehicle-text">
                  <span class="vehicle-name">{vehicle.name}</span>
                  <span class="vehicle-traits">
                    {#each vehicle.traits as t, i (t.name)}{#if i}<span class="sep" aria-hidden="true">·</span>{/if}{#if t.desc}<HoverTip text={t.name}>{t.desc}</HoverTip>{:else}{t.name}{/if}{/each}
                  </span>
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

          <Panel title="Installed parts" collapseKey="planner.parts" count={`${String(parts.length)} / ${String(A.maxParts(planner))}`}>
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
        </div>

        <div class="stack -side">
          <Panel title="Racer style" collapseKey="planner.style">
            {#if style}
              <StylePanel name={style.name} icon={style.icon} rank={style.rank} {traits} onchange={() => (picker = { kind: 'style' })} />
            {/if}
            {#if ranks.length > 1}
              <ModeSwitch label="Style rank" options={ranks.map((r) => ({ value: r.id, label: `Rank ${String(r.rank)}` }))} value={build.style} onchange={(id: StyleId) => { update(A.setRank(build, id)); }} />
            {/if}
          </Panel>

          <Panel title="Abilities" collapseKey="planner.abilities" count={`${String(regular.length)} / ${String(A.maxAbilities(planner))}${crash === undefined ? '' : ' + crash'}`}>
            <div class="abilities">
              {#each Array.from({ length: A.maxAbilities(planner) }, (_, i) => i) as i (i)}
                {@const id = regular[i]}
                <AbilitySlot
                  ability={abilityById(id)}
                  label={`Ability ${String(i + 1)}`}
                  {...cooldownOf(id)}
                  onselect={() => (picker = { kind: 'ability', slot: i })}
                  {...id === undefined ? {} : { onremove: () => { update(A.removeAbility(build, id)); } }}
                />
              {/each}
              <AbilitySlot
                ability={abilityById(crash)}
                label="Crash ability"
                takes="crash ability"
                {...cooldownOf(crash)}
                onselect={() => (picker = { kind: 'ability', slot: 'crash' })}
                {...crash === undefined ? {} : { onremove: () => { update(A.removeAbility(build, crash)); } }}
              />
            </div>
          </Panel>

          {#if build.mode === 'campaign'}
            <Panel title="Favours" collapseKey="planner.favours" count={String(favours.length)}>
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
      </div>
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

  <Drawer open={picker !== null} title={picker?.kind === 'ability' && picker.slot === 'crash' ? 'Choose a crash ability' : picker ? PICKER_TITLE[picker.kind] : ''} onclose={() => { picker = null; screenshot = null; }}>
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
      <AbilityPicker {build} slot={slot === 'crash' ? 'crash' : 'regular'} onpick={(id: AbilityId) => { pick(A.placeAbility(planner, build, id, slot === 'crash' ? 0 : slot)); }} />
    {:else if picker?.kind === 'favorites'}
      {#if favorites.length}
        <div class="favorites">
          {#each favorites as f (f.id)}
            <FavoriteRow
              name={f.name}
              summary={summarize(planner, f)}
              onopen={() => { pick(decodeBuild(f.code)); say(`Loaded ${f.name}.`); }}
              onrename={(n: string) => { favorites = renameFavorite(favorites, f.id, n); }}
              onremove={() => { favorites = removeFavorite(favorites, f.id); }}
              oncopy={() => copyText(`${location.origin}${location.pathname}#${f.code}`)}
            />
          {/each}
        </div>
      {:else}
        <p class="empty">No favourites yet. Use “Save to favourites” to keep a build here; they stay in this browser.</p>
      {/if}
    {:else if picker?.kind === 'part'}
      <PartPicker {build} onadd={(id: PartId) => { pick(A.addPart(planner, build, id)); }} />
    {:else if picker?.kind === 'favour'}
      <FavourPicker {build} onadd={(id: FavourId) => { pick(A.addFavour(planner, build, id)); }} />
    {:else if picker?.kind === 'import'}
      <ScreenshotImport
        file={screenshot}
        onapply={(b: Build) => {
          pick(b);
          screenshot = null;
          say('Build imported from the screenshot.');
        }}
      />
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

  // Two independent stacks, so a tall Abilities panel never leaves a gap under Vehicle stats. Where there's only
  // room for one column, the stacks dissolve and the panels keep the game's order.
  .layout > .overview {
    min-width: 0;
    container-type: inline-size;
  }

  .overview > .panels {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
    align-items: start;

    @container (width < 700px) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .panels > .stack {
    display: grid;
    gap: var(--space-4);
    min-width: 0;

    @container (width < 700px) {
      display: contents;

      // stats, style, abilities, parts, favours
      &.-main > :global(:nth-child(1)) { order: 1; }
      &.-main > :global(:nth-child(2)) { order: 4; }
      &.-side > :global(:nth-child(1)) { order: 2; }
      &.-side > :global(:nth-child(2)) { order: 3; }
      &.-side > :global(:nth-child(3)) { order: 5; }
    }
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

    .sep {
      margin: 0 0.35em;
    }
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

  .favorites {
    display: grid;
    gap: var(--space-2);
  }

  .empty {
    margin: 0;
    color: var(--color-muted);
    font-size: 13.5px;
  }
</style>
