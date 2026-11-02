<script lang="ts">
  import type { ActiveCount } from '~/lib/engine/build.ts';

  interface Props {
    /** What grants it, e.g. "Calibrating Landings I". */
    owner: string;
    /** The game's own description of the effect. */
    desc?: string;
    /** Counted per trigger (a number) instead of on/off. */
    repeatable: boolean;
    /** Counted in seconds of something instead, e.g. "airborne". */
    perSecond?: string;
    /** When it applies, in plain words ("Burning + Ramjet ready"), where the description alone doesn't say. */
    when?: string;
    /** What a count counts, e.g. "opponents hit"; per-trigger effects say "× triggers". */
    countLabel?: string;
    value: ActiveCount | undefined;
    onchange: (value: ActiveCount | undefined) => void;
  }

  const MAX_TIMES = 50;
  const { owner, desc, repeatable, perSecond, when, countLabel, value, onchange }: Props = $props();
  const counted = $derived(repeatable || perSecond !== undefined);
  // timed and counted effects say what they count beside the field, so only per-trigger effects need the note
  const stacks = $derived(repeatable && !perSecond && !countLabel ? 'Stacks each time it triggers.' : '');
  const id = $props.id();
  const detail = $derived([stacks, desc ?? ''].filter(Boolean).join(' '));
  const described = $derived([when && `${id}-when`, detail && `${id}-detail`].filter(Boolean).join(' ') || undefined);
  const times = $derived(value === true ? 1 : (value ?? 0));

  function setTimes(raw: string): void {
    const n = Math.max(0, Math.min(MAX_TIMES, Math.floor(Number(raw) || 0)));
    onchange(n === 0 ? undefined : n);
  }
</script>

<div class={['situational-effect', counted && '-stacking']}>
  {#if counted}
    <input
      class="times"
      id={`${id}-control`}
      type="number"
      min="0"
      max={MAX_TIMES}
      step="1"
      inputmode="numeric"
      value={times}
      aria-describedby={described}
      oninput={(e) => { setTimes(e.currentTarget.value); }}
    />
    <label class="owner" for={`${id}-control`}>{owner} <span class="unit">{countLabel ?? (perSecond ? `seconds ${perSecond}` : '× triggers')}</span></label>
  {:else}
    <input
      class="check"
      id={`${id}-control`}
      type="checkbox"
      checked={value !== undefined && value !== 0}
      aria-describedby={described}
      onchange={(e) => { onchange(e.currentTarget.checked ? true : undefined); }}
    />
    <label class="owner" for={`${id}-control`}>{owner}</label>
  {/if}
  {#if when}<span class="when" id={`${id}-when`}>{when}</span>{/if}
  {#if detail}<small class="detail" id={`${id}-detail`}>{detail}</small>{/if}
</div>

<style lang="scss">
  .situational-effect {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 2px 10px;
    align-items: center;
    padding: 8px 10px;
    border: 1px solid var(--color-line);
    border-left: 4px solid var(--color-cond);
    border-radius: var(--radius-md);
    background: var(--color-panel);
  }

  .situational-effect > .check {
    accent-color: var(--color-cond);
  }

  .situational-effect > .times {
    width: 3.5em;
    padding: 3px 4px;
    border: 1px solid var(--color-line);
    border-radius: 4px;
    background: var(--color-panel);
    color: var(--color-fg);
    font: 13px var(--font-mono);
  }

  .situational-effect > .owner {
    font-weight: 600;
    cursor: pointer;

    .unit {
      color: var(--color-muted);
      font: italic 500 13px var(--font-label);
    }
  }

  .situational-effect > .when {
    grid-column: 2;
    font: 600 13.5px/1.3 var(--font-label);
  }

  .situational-effect > .detail {
    grid-column: 2;
    color: var(--color-muted);
    font-size: 12.5px;
  }
</style>
