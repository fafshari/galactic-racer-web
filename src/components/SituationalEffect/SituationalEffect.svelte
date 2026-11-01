<script lang="ts">
  import type { ActiveCount } from '~/lib/engine/build.ts';

  interface Props {
    /** What grants it, e.g. "Calibrating Landings I". */
    owner: string;
    /** What sets it off, e.g. "Vehicle Landing". */
    detail: string;
    desc?: string;
    /** Counted per trigger (a number) instead of on/off. */
    repeatable: boolean;
    value: ActiveCount | undefined;
    onchange: (value: ActiveCount | undefined) => void;
  }

  const MAX_TIMES = 50;
  const { owner, detail, desc, repeatable, value, onchange }: Props = $props();
  const id = $props.id();
  const times = $derived(value === true ? 1 : (value ?? 0));

  function setTimes(raw: string): void {
    const n = Math.max(0, Math.min(MAX_TIMES, Math.floor(Number(raw) || 0)));
    onchange(n === 0 ? undefined : n);
  }
</script>

<div class={['situational-effect', repeatable && '-stacking']}>
  {#if repeatable}
    <input
      class="times"
      id={`${id}-control`}
      type="number"
      min="0"
      max={MAX_TIMES}
      step="1"
      inputmode="numeric"
      value={times}
      aria-describedby={`${id}-detail`}
      oninput={(e) => { setTimes(e.currentTarget.value); }}
    />
    <label class="owner" for={`${id}-control`}>{owner} <span class="unit">× triggers</span></label>
  {:else}
    <input
      class="check"
      id={`${id}-control`}
      type="checkbox"
      checked={value !== undefined && value !== 0}
      aria-describedby={`${id}-detail`}
      onchange={(e) => { onchange(e.currentTarget.checked ? true : undefined); }}
    />
    <label class="owner" for={`${id}-control`}>{owner}</label>
  {/if}
  <small class="detail" id={`${id}-detail`}>
    {[repeatable ? 'Stacks each time it triggers.' : '', detail, desc ? `— ${desc}` : ''].filter(Boolean).join(' ')}
  </small>
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

  .situational-effect > .detail {
    grid-column: 2;
    color: var(--color-muted);
    font-size: 12.5px;
  }
</style>
