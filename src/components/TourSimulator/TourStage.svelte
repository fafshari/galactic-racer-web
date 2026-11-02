<script lang="ts">
  import { planner } from '~/lib/data/index.ts';
  import type { AbilityId, PartId, SlotId } from '~/lib/data/types.ts';
  import { evaluate } from '~/lib/engine/index.ts';
  import { isSituational } from '~/lib/planner/actions.ts';
  import type { Synergy } from '~/lib/synergy/synergy.ts';
  import { rateOffers, type Fit, type FitKind } from '~/lib/tour/fit.ts';
  import {
    abilityParent, buildOf, contractOf, credits, formRank, isAbilityUpgrade, isUnderdog, ownedSlotOf, packPrice, partPrice, planetOf,
    replaces, rerollPrice, singular, unitLabel, type TourAction, type TourState,
  } from '~/lib/tour/tour.ts';
  import Button from '../Button/Button.svelte';
  import ChoiceCard from '../ChoiceCard/ChoiceCard.svelte';
  import ModeSwitch from '../ModeSwitch/ModeSwitch.svelte';
  import PartCard from '../PartCard/PartCard.svelte';
  import Tag from '../Tag/Tag.svelte';
  import FinishPicker from './FinishPicker.svelte';

  interface Props {
    tour: TourState;
    synergy: Synergy;
    act: (a: TourAction) => void;
  }

  const { tour, synergy, act }: Props = $props();
  const T = planner.tour;
  const planet = $derived(planetOf(planner, tour));
  const bet = $derived(T.risk.find((r) => r.id === tour.bet));
  const partsFull = $derived(tour.parts.length >= planner.meta.partSlots.max);
  const abilitiesFull = $derived(tour.abilities.length >= planner.meta.abilitySlots);
  const ordinal = (n: number): string => `${String(n)}${['st', 'nd', 'rd'][n - 1] ?? 'th'}`;

  const part = (id: string) => planner.affixes.find((p) => p.id === id);
  const ability = (id: string) => planner.abilities.find((a) => a.id === id);
  const slot = (id: string) => planner.slots.find((s) => s.id === id);
  const fits = (kind: FitKind, ids: readonly string[]): Map<string, Fit> => rateOffers(synergy, tour, kind, ids);
  const upgradesNote = (id: PartId): string | null => {
    if (!replaces(planner, tour, id)) return null;
    return `Upgrades ${part(tour.parts[ownedSlotOf(planner, tour, part(id))] ?? '')?.name ?? ''}`;
  };
</script>

{#snippet fitLine(f: Fit | undefined)}
  {#if f?.label}<span class="fit"><Tag variant="good">{f.label}</Tag><span class="why">{f.reason}</span></span>{/if}
{/snippet}

{#snippet partOffer(id: PartId, fit: Fit | undefined, action: string, disabled: boolean, onpick: () => void)}
  {@const p = part(id)}
  {#if p}
    {@const up = upgradesNote(id)}
    <PartCard part={p} situational={isSituational(p)} {disabled} onselect={onpick}>
      {#snippet footer()}
        {#if up}<span class="upgrade" title={up}><Tag variant="good">Upgrade</Tag><span class="_visually-hidden">: {up}</span></span>{/if}
        {@render fitLine(fit)}
        <Button size="sm" {disabled} onclick={onpick}>{action}</Button>
      {/snippet}
    </PartCard>
  {/if}
{/snippet}

{#snippet upgradeOffer(id: SlotId, fit: Fit | undefined, onpick: () => void)}
  {@const s = slot(id)}
  {#if s}
    {@const lv = tour.levels[id] ?? 0}
    <ChoiceCard icon={s.icon} title={s.name} note={`${String(lv)} → ${String(Math.min(10, lv + tour.upgradeSize))}${fit?.label ? ` · ${fit.label}` : ''}`} subtitle={fit?.label ? fit.reason : s.part} pressed={false} onclick={onpick} />
  {/if}
{/snippet}

{#snippet abilityOffer(id: AbilityId, fit: Fit | undefined, onpick: () => void)}
  {@const a = ability(id)}
  {#if a}
    {@const upgrade = isAbilityUpgrade(planner, tour, id)}
    <ChoiceCard
      icon={a.icon}
      title={a.name}
      note={[a.level.replace('Level', 'Lv '), upgrade ? `upgrades ${ability(abilityParent(planner, id) ?? '')?.name ?? ''}` : 'new', fit?.label].filter(Boolean).join(' · ')}
      subtitle={fit?.label ? `${fit.reason}. ${a.desc}` : a.desc}
      pressed={false}
      disabled={abilitiesFull && !upgrade}
      onclick={onpick}
    />
  {/if}
{/snippet}

<div class="tour-stage">
  {#if tour.phase === 'setup'}
    <h2 class="title">Start a Multiplayer Tour</h2>
    <p class="lead">Pick a vehicle and racer style, then race six planets. After each race you choose rewards, then spend credits in the shop. Your build updates alongside as you go.</p>
    <h3 class="subhead">Vehicle</h3>
    <div class="choices">
      {#each planner.vehicles.filter((v) => planner.meta.modes.mp.vehicles.includes(v.id)) as v (v.id)}
        <ChoiceCard icon={v.icon} title={v.name} subtitle={v.traits.map((t) => t.name).join(' · ')} pressed={tour.vehicle === v.id} onclick={() => { act({ type: 'setVehicle', id: v.id }); }} />
      {/each}
    </div>
    <h3 class="subhead">Racer style</h3>
    <div class="choices">
      {#each planner.styles.filter((s) => s.mode === 'mp') as s (s.id)}
        <ChoiceCard icon={s.icon} title={s.name} subtitle={`Starts with ${s.abilities.map((id) => ability(id)?.name ?? id).join(', ')}`} pressed={tour.style === s.id} onclick={() => { act({ type: 'setStyle', id: s.id }); }} />
      {/each}
    </div>
    <h3 class="subhead">Assumptions</h3>
    <div class="assumptions">
      <span class="label">Options per reward or pack</span>
      <ModeSwitch label="Options per reward or pack" options={[2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} value={String(tour.options)} onchange={(v: string) => { act({ type: 'setOptions', n: Number(v) }); }} />
      <span class="label">Each upgrade adds</span>
      <ModeSwitch label="Each upgrade adds" options={[1, 2, 3].map((n) => ({ value: String(n), label: `+${String(n)}` }))} value={String(tour.upgradeSize)} onchange={(v: string) => { act({ type: 'setUpgradeSize', n: Number(v) }); }} />
    </div>
    <div class="actions"><Button variant="primary" onclick={() => { act({ type: 'start' }); }}>Start tour</Button><span class="hint">Run seed {tour.seed}</span></div>
  {:else if tour.phase === 'backer' && planet}
    <h2 class="title">{planet.name}: choose a backer</h2>
    <p class="lead">Three backers each offer a contract for this race. Pick one; you earn its rate for every unit of the objective you achieve.</p>
    <div class="choices">
      {#each tour.backers as o, i (o.backer)}
        {@const b = T.backers[o.backer]}
        {@const c = contractOf(planner, o)}
        {#if b && c}
          <ChoiceCard
            icon={b.icon}
            title={b.name}
            note={`${credits(c.perUnit)} per ${singular(unitLabel(c.units))}`}
            subtitle={`${c.name}${c.target === null ? '' : ` Target ${String(c.target)} ${unitLabel(c.units)}.`}`}
            pressed={tour.backer === i}
            onclick={() => { act({ type: 'pickBacker', index: i }); }}
          />
        {/if}
      {/each}
    </div>
    <div class="actions"><Button variant="primary" disabled={tour.backer === null} onclick={() => { act({ type: 'goTo', phase: 'bet' }); }}>Next: place your bet</Button></div>
  {:else if tour.phase === 'bet' && planet}
    <h2 class="title">{planet.name}: place your bet</h2>
    {#if tour.planet > 0}
      {@const rank = formRank(tour)}
      <div class="underdog">
        {#if isUnderdog(planner, tour)}
          <strong class="headline">You are the Underdog!</strong>
          <span>Win any bet to receive a bonus reward: an extra upgrade and {credits(planet.underdogCredits)}.</span>
        {:else}
          <span>Form {rank.score} pts, {ordinal(rank.place)} of 12. The bottom {T.form.underdogs} are Underdogs.</span>
        {/if}
        <label class="switch"><input type="checkbox" checked={isUnderdog(planner, tour)} onchange={(e) => { act({ type: 'setUnderdog', value: e.currentTarget.checked }); }} /> I'm the Underdog this race (match what the game shows)</label>
      </div>
    {/if}
    <p class="lead">Before the race, bet on where you'll finish. Win the bet and you pick a part from a set of options, one of which is guaranteed to be that rarity or better; or take the credits instead.</p>
    <div class="choices">
      {#each T.risk as r (r.id)}
        <ChoiceCard
          icon={null}
          title={r.name}
          note={`P${String(r.minFinish)} or better`}
          subtitle={`${String(tour.options + r.extraOptions)} part options, one guaranteed ${r.minRarity}+, or ${credits(r.skipCredits)}`}
          pressed={tour.bet === r.id}
          onclick={() => { act({ type: 'pickBet', id: r.id }); }}
        />
      {/each}
    </div>
    <div class="actions">
      <Button variant="primary" disabled={tour.bet === null} onclick={() => { act({ type: 'goTo', phase: 'race' }); }}>Go to the race</Button>
      <Button onclick={() => { act({ type: 'goTo', phase: 'backer' }); }}>Change backer</Button>
    </div>
  {:else if tour.phase === 'race' && planet && bet}
    <h2 class="title">{planet.name}: race</h2>
    <p class="lead">Where did you finish? Highlighted positions win your {bet.name.toLowerCase()} bet. Pays {credits(planet.baseCredits)} plus placing credits.</p>
    <FinishPicker value={tour.finish} winsUpTo={bet.minFinish} onchange={(n: number) => { act({ type: 'setFinish', position: n }); }} />
    {#if tour.backer !== null}
      {@const o = tour.backers[tour.backer]}
      {@const c = o ? contractOf(planner, o) : undefined}
      {#if o && c}
        <div class="contract">
          <label class="label" for="contract-units">{T.backers[o.backer]?.name}: {c.name} How many {unitLabel(c.units)}?</label>
          <input id="contract-units" class="units" type="number" min="0" step="1" inputmode="numeric" value={tour.contractUnits} oninput={(e) => { act({ type: 'setUnits', n: Number(e.currentTarget.value) }); }} />
          <span class="pay">+{credits(tour.contractUnits * c.perUnit)}</span>
        </div>
      {/if}
    {/if}
    <div class="actions">
      <Button onclick={() => { act({ type: 'setFinish', position: 1 + Math.floor(Math.random() * 12) }); }}>Roll a random finish</Button>
      <Button variant="primary" disabled={tour.finish === null} onclick={() => { act({ type: 'finishRace' }); }}>Finish race</Button>
      <Button onclick={() => { act({ type: 'goTo', phase: 'bet' }); }}>Change bet</Button>
    </div>
  {:else if tour.phase === 'rewards' && planet && tour.offer}
    {@const q = tour.queue[0]}
    {@const offer = tour.offer}
    {@const rated = fits(offer.kind, offer.ids)}
    <h2 class="title">{planet.name}: {q?.title}</h2>
    <ol class="queue">
      {#each tour.queue as item, i (i)}
        <li class={['item', i === 0 && '-now']}><span>{item.title}</span><span class="hint">{item.note}</span></li>
      {/each}
    </ol>
    <p class="lead">
      Choose one.{#if offer.kind === 'part' && !offer.ids.some((id) => rated.get(id)?.label)} None of these really fit your build; take the strongest on its own merits, or the credits.{/if}
    </p>
    {#if offer.kind === 'part' && partsFull}<p class="lead">All part slots are full. Remove a part to make room, or skip. Upgrades of parts you own still fit.</p>{/if}
    <div class={offer.kind === 'part' ? 'cards' : 'choices'}>
      {#if offer.kind === 'upgrade'}
        {#each offer.ids as id (id)}{@render upgradeOffer(id, rated.get(id), () => { act({ type: 'takeReward', id }); })}{/each}
      {:else}
        {#each offer.ids as id (id)}{@render partOffer(id, rated.get(id), 'Take', partsFull && !replaces(planner, tour, id), () => { act({ type: 'takeReward', id }); })}{/each}
      {/if}
    </div>
    <div class="actions">
      {#if offer.kind === 'part' && offer.skip}
        <Button onclick={() => { act({ type: 'skipReward' }); }}>Skip for {credits(offer.skip)}</Button>
      {:else if !(q?.kind === 'upgrade' && !q.skippable)}
        <Button onclick={() => { act({ type: 'skipReward' }); }}>Skip</Button>
      {/if}
    </div>
  {:else if tour.phase === 'shop' && planet && tour.shop}
    {@const shop = tour.shop}
    {@const rated = fits('part', shop.parts.filter((id) => !shop.sold.includes(id)))}
    {@const last = tour.planet >= T.planets.length - 1}
    <h2 class="title">{planet.name}: shop</h2>
    <p class="lead">Spend credits, reroll the offers, or move on. Rerolls get {credits(T.prices.rerollIncrease)} pricier each time; packs {credits(T.prices.partPackIncrease)} each time you open one.</p>
    {#if shop.pack}
      {@const pack = shop.pack}
      <h3 class="subhead">{pack.kind === 'stat' ? 'Upgrade Pack' : 'Ability Pack'}: choose one</h3>
      {#if pack.kind === 'ability' && abilitiesFull}<p class="lead">All ability slots are full. Upgrades of abilities you own still fit; for a new one, remove one first.</p>{/if}
      <div class="choices">
        {#if pack.kind === 'stat'}
          {@const packFits = fits('upgrade', pack.ids)}
          {#each pack.ids as id (id)}{@render upgradeOffer(id, packFits.get(id), () => { act({ type: 'takePack', id }); })}{/each}
        {:else}
          {@const packFits = fits('ability', pack.ids)}
          {#each pack.ids as id (id)}{@render abilityOffer(id, packFits.get(id), () => { act({ type: 'takePack', id }); })}{/each}
        {/if}
      </div>
    {/if}
    <h3 class="subhead">Parts</h3>
    <div class="cards">
      {#each shop.parts as id (id)}
        {@const p = part(id)}
        {@const sold = shop.sold.includes(id)}
        {#if p}{@render partOffer(id, rated.get(id), sold ? 'Sold' : `Buy · ${credits(partPrice(planner, p))}`, sold || (partsFull && !replaces(planner, tour, id)), () => { act({ type: 'buyPart', id }); })}{/if}
      {:else}
        <p class="hint">No parts left to offer.</p>
      {/each}
    </div>
    <h3 class="subhead">Packs</h3>
    <div class="choices">
      <ChoiceCard icon={null} title="Upgrade Pack" note={credits(packPrice(planner, shop, 'stat'))} subtitle={`Choose one of ${String(tour.options)} stat upgrades`} pressed={false} disabled={shop.pack !== null} onclick={() => { act({ type: 'openPack', kind: 'stat' }); }} />
      <ChoiceCard icon={null} title="Ability Pack" note={credits(packPrice(planner, shop, 'ability'))} subtitle={`Choose one of ${String(tour.options)} abilities`} pressed={false} disabled={shop.pack !== null} onclick={() => { act({ type: 'openPack', kind: 'ability' }); }} />
    </div>
    <div class="actions">
      <Button disabled={shop.pack !== null} onclick={() => { act({ type: 'reroll' }); }}>Reroll offers ({credits(rerollPrice(planner, shop))})</Button>
      <Button variant="primary" disabled={shop.pack !== null} onclick={() => { act({ type: 'leaveShop' }); }}>{last ? 'Finish the tour' : `Leave for ${T.planets[tour.planet + 1]?.name ?? 'the next planet'}`}</Button>
    </div>
  {:else if tour.phase === 'done'}
    {@const power = evaluate(planner, buildOf(tour)).power}
    <h2 class="title">Tour complete</h2>
    <p class="lead">You earned {credits(tour.earned)} and spent {credits(tour.spent)} over {T.planets.length} planets, finishing with power rating {power}, {tour.parts.length} parts and {tour.abilities.length} abilities.</p>
    <div class="actions">
      <Button variant="primary" onclick={() => { act({ type: 'newRun', seed: Math.floor(Math.random() * 1e9) }); }}>Race another tour</Button>
      <Button onclick={() => { act({ type: 'replay' }); }}>Replay this seed</Button>
    </div>
  {/if}
</div>

<style lang="scss">
  .tour-stage {
    display: grid;
    gap: var(--space-3);
  }

  .tour-stage > .title {
    font-size: 19px;
    font-weight: 900;
  }

  .tour-stage > .subhead {
    margin-top: var(--space-2);
    font-size: 12.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
  }

  .tour-stage > .lead {
    max-width: 70ch;
    margin: 0;
    color: var(--color-muted);
  }

  .tour-stage > .choices {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
    gap: var(--space-2);
  }

  .tour-stage > .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    grid-auto-rows: max-content;
    gap: 10px;
  }

  .tour-stage > .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }

  .tour-stage > .assumptions {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-2) var(--space-3);
    align-items: center;

    .label {
      font: italic 600 14px var(--font-label);
    }
  }

  .tour-stage > .underdog {
    display: grid;
    gap: 6px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: var(--color-cond-bg);
    color: var(--color-cond);

    .headline {
      font: 800 13px var(--font-display);
      text-transform: uppercase;
    }

    .switch {
      display: flex;
      gap: var(--space-2);
      align-items: center;
      color: var(--color-fg);
      font-size: 13px;
    }
  }

  .tour-stage > .contract {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: var(--color-sunk);

    .units {
      width: 6em;
      padding: 6px 8px;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      background: var(--color-panel);
      color: var(--color-fg);
      font: 600 15px var(--font-mono);
    }

    .pay {
      color: var(--color-up);
      font: 600 15px var(--font-mono);
    }
  }

  .tour-stage > .queue {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;

    .item {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      justify-content: space-between;
      padding: 8px 10px;
      border-radius: var(--radius-md);
      background: var(--color-sunk);
      font-size: 13.5px;

      &.-now {
        outline: 2px solid var(--color-accent);
        background: var(--color-accent-soft);
      }
    }
  }

  .hint {
    color: var(--color-muted);
    font: italic 500 14px var(--font-label);
  }

  .fit {
    display: grid;
    gap: 2px;
    justify-items: center;

    .why {
      color: var(--color-muted);
      font: italic 500 12.5px/1.25 var(--font-label);
    }
  }
</style>
