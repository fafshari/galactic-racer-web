<script lang="ts">
  // Screenshot import (ADR 0016): takes an image (pasted, dropped or chosen), reads it, and lets the player check
  // the doubtful slots before the build replaces the current one. The OCR engine loads only when an image arrives.
  import { planner } from '~/lib/data/index.ts';
  import type { GameMode } from '~/lib/data/types.ts';
  import { abilityAllowed, partAllowed, type Build } from '~/lib/engine/index.ts';
  import { assembleBuild, CONFIDENT, CRASH_SLOT, ScreenshotError, topSpeedKmh, type Reading, type ScreenshotReading } from '~/lib/import/index.ts';
  import Button from '../Button/Button.svelte';
  import Tag from '../Tag/Tag.svelte';

  interface Props {
    /** An image handed over by the planner (pasted or dropped onto the page). */
    file: Blob | null;
    onapply: (build: Build) => void;
  }

  const { file, onapply }: Props = $props();

  type Phase =
    | { kind: 'pick' }
    | { kind: 'reading'; step: string }
    | { kind: 'review'; result: ScreenshotReading }
    | { kind: 'error'; message: string };

  const byName = <T extends { name: string }>(a: T, b: T): number => a.name.localeCompare(b.name);

  let phase = $state<Phase>({ kind: 'pick' });
  let readings = $state<Reading[]>([]);
  let dragging = $state(false);
  let lastFile: Blob | null = null;

  $effect(() => {
    if (file && file !== lastFile) void read(file);
  });

  async function read(image: Blob): Promise<void> {
    lastFile = image;
    if (!image.type.startsWith('image/')) {
      phase = { kind: 'error', message: "That file isn't an image. Paste or drop a screenshot (PNG, JPEG or WebP)." };
      return;
    }
    phase = { kind: 'reading', step: 'Reading the image…' };
    try {
      const { importScreenshot } = await import('./screenshot.ts');
      const result = await importScreenshot(image, (step: string) => (phase = { kind: 'reading', step }));
      readings = result.readings;
      phase = { kind: 'review', result };
    } catch (e) {
      phase = { kind: 'error', message: e instanceof ScreenshotError ? e.message : "The screenshot couldn't be read. Try again, or a sharper screenshot." };
    }
  }

  function chosen(e: Event): void {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    if (f) void read(f);
    input.value = '';
  }

  function dropped(e: DragEvent): void {
    e.preventDefault();
    dragging = false;
    const f = e.dataTransfer?.files[0];
    if (f) void read(f);
  }

  // ---- review -----------------------------------------------------------------------------------------------
  const styleId = $derived(readings.find((r) => r.kind === 'style')?.id ?? null);
  const mode = $derived<GameMode>(planner.styles.find((s) => s.id === styleId)?.mode ?? 'mp');
  const vehicles = $derived(planner.vehicles.filter((v) => planner.meta.modes[mode].vehicles.includes(v.id)));
  const styles = [...planner.styles].sort((a, b) => byName(a, b) || a.mode.localeCompare(b.mode) || (a.rank ?? 0) - (b.rank ?? 0));
  const abilities = $derived(planner.abilities.filter((a) => abilityAllowed(a, mode)).sort(byName));
  const parts = $derived(planner.affixes.filter((p) => partAllowed(p, mode)).sort(byName));
  const toCheck = $derived(readings.filter((r) => r.confidence < CONFIDENT).length);

  const styleLabel = (s: (typeof planner.styles)[number]): string =>
    `${s.name} · ${planner.meta.modes[s.mode].name}${s.rank === null ? '' : ` · Rank ${String(s.rank)}`}`;

  /** The player's fix replaces the reading and counts as checked. */
  function fix(index: number, value: string): void {
    const r = readings[index];
    if (!r) return;
    if (r.kind === 'level') {
      readings[index] = { ...r, level: Number(value), confidence: 1 };
      return;
    }
    const lists = { vehicle: planner.vehicles, style: planner.styles, ability: planner.abilities, part: planner.affixes } as const;
    const found = (lists[r.kind] as readonly { id: string }[]).some((x) => x.id === value);
    readings[index] = { ...r, id: found ? value : null, confidence: 1 } as Reading;
  }

  const slotName = (r: Reading): string => {
    switch (r.kind) {
      case 'vehicle':
        return 'Vehicle';
      case 'style':
        return 'Racer style';
      case 'ability':
        return r.index === CRASH_SLOT ? 'Crash ability' : `Ability ${String(r.index + 1)}`;
      case 'part':
        return `Part ${String(r.index + 1)}`;
      case 'level':
        return planner.slots.find((s) => s.id === r.slot)?.name ?? r.slot;
    }
  };

  const build = $derived(assembleBuild(readings));
  // The screen prints the build's top speed: a cross-check on the stat levels and speed parts that were read.
  const speedCheck = $derived.by(() => {
    if (phase.kind !== 'review' || phase.result.shownSpeed === null) return null;
    const computed = topSpeedKmh(build);
    return { shown: phase.result.shownSpeed, computed, agrees: Math.abs(computed - phase.result.shownSpeed) <= 1 };
  });
</script>

<div class="screenshot-import">
  {#if phase.kind === 'pick' || phase.kind === 'error'}
    <label
      class={['drop', dragging && '-active']}
      ondragover={(e) => { e.preventDefault(); dragging = true; }}
      ondragleave={() => (dragging = false)}
      ondrop={dropped}
    >
      <input class="_visually-hidden" type="file" accept="image/*" onchange={chosen} />
      <strong class="lead">Paste a screenshot of the game's Build screen</strong>
      <span class="how">Press Ctrl+V (⌘V on a Mac), drop the image here, or <span class="link">choose a file</span>.</span>
    </label>
    {#if phase.kind === 'error'}<p class="error" role="alert">{phase.message}</p>{/if}
    <p class="hint">
      Hide tooltips in the game first (Toggle Tooltip Visibility), so none of your parts are covered. The image is read on
      this device and never uploaded.
    </p>
  {:else if phase.kind === 'reading'}
    <p class="progress" role="status">{phase.step}</p>
  {:else}
    <p class="summary" role="status">
      {#if toCheck}
        {toCheck} {toCheck === 1 ? 'slot needs' : 'slots need'} checking. Fix anything that's wrong, then use the build.
      {:else}
        Every slot was read clearly. Check it over, then use the build.
      {/if}
    </p>
    <ul class="readings">
      {#each readings as r, i (`${r.kind}-${r.kind === 'level' ? r.slot : String(r.index)}`)}
        <li class={['reading', r.confidence < CONFIDENT && '-doubtful']}>
          <label class="name" for={`import-${String(i)}`}>{slotName(r)}</label>
          {#if r.kind === 'level'}
            <select id={`import-${String(i)}`} value={String(r.level)} onchange={(e) => { fix(i, e.currentTarget.value); }}>
              {#each Array.from({ length: 11 }, (_, n) => n) as n (n)}<option value={String(n)}>{n}</option>{/each}
            </select>
          {:else}
            <select id={`import-${String(i)}`} value={r.id ?? ''} onchange={(e) => { fix(i, e.currentTarget.value); }}>
              {#if r.kind === 'vehicle'}
                {#each vehicles as v (v.id)}<option value={v.id}>{v.name}</option>{/each}
              {:else if r.kind === 'style'}
                {#each styles as s (s.id)}<option value={s.id}>{styleLabel(s)}</option>{/each}
              {:else if r.kind === 'ability'}
                <option value="">Empty</option>
                {#each abilities as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
              {:else}
                <option value="">No part</option>
                {#each parts as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
              {/if}
            </select>
          {/if}
          {#if r.confidence < CONFIDENT}
            <span class="flag"><Tag variant="neg">Check</Tag></span>
            {#if r.kind !== 'level' && r.note}
              <span class="detail">{r.note}</span>
            {:else if r.kind !== 'level' && r.text}
              <span class="detail">Read as “{r.text}”</span>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
    {#if speedCheck}
      {@const check = speedCheck}
        <p class={['speed', !check.agrees && '-off']}>
          {#if check.agrees}
            Top speed {check.computed} km/h matches the screenshot.
          {:else}
            The screenshot shows {check.shown} km/h but this build gives {check.computed} km/h. A stat level or speed part may
            be misread.
          {/if}
        </p>
    {/if}
    {#if mode === 'campaign'}<p class="hint">Favours aren't on the Build screen; add them after importing.</p>{/if}
    <div class="actions">
      <Button variant="primary" onclick={() => { onapply($state.snapshot(build)); }}>Use this build</Button>
      <Button onclick={() => (phase = { kind: 'pick' })}>Try another screenshot</Button>
    </div>
  {/if}
</div>

<style lang="scss">
  .screenshot-import {
    display: grid;
    gap: var(--space-3);
  }

  .screenshot-import > .drop {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-5) var(--space-4);
    border: 2px dashed var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-panel);
    text-align: center;
    cursor: pointer;

    &.-active,
    &:hover,
    &:focus-within {
      border-color: var(--color-accent);
    }

    .lead {
      font: 700 15px var(--font-label);
    }

    .how {
      color: var(--color-muted);
    }

    .link {
      color: var(--color-accent);
      text-decoration: underline;
    }
  }

  .screenshot-import > .hint,
  .screenshot-import > .progress,
  .screenshot-import > .summary {
    margin: 0;
    color: var(--color-muted);
    font-size: 13.5px;
  }

  .screenshot-import > .summary,
  .screenshot-import > .progress {
    color: var(--color-fg);
    font-size: 14.5px;
  }

  .screenshot-import > .error {
    margin: 0;
    color: var(--color-down);
  }

  .screenshot-import > .readings {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .readings > .reading {
    display: grid;
    grid-template-columns: 8.5em minmax(0, 1fr) auto;
    gap: var(--space-1) var(--space-2);
    align-items: center;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);

    &.-doubtful {
      background: var(--color-sunk);
    }

    .name {
      font: 600 13.5px var(--font-label);
    }

    select {
      min-width: 0;
      padding: 5px 8px;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-panel);
      color: var(--color-fg);
      font: inherit;
    }

    .detail {
      grid-column: 2 / -1;
      color: var(--color-muted);
      font-size: 12.5px;
    }
  }

  .screenshot-import > .speed {
    margin: 0;
    color: var(--color-up);
    font-size: 13.5px;

    &.-off {
      color: var(--color-down);
    }
  }

  .screenshot-import > .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
