<script lang="ts">
  import type { CurveChart } from '~/lib/format/format.ts';
  import { fmt } from '~/lib/format/format.ts';

  interface Props {
    chart: CurveChart;
    /** [input, output] axis names, e.g. ["Speed (km/h)", "Turn radius (m)"]. */
    axes: readonly [string, string];
    /** Text alternative: what changed. */
    label: string;
  }

  const { chart, axes, label }: Props = $props();

  // drawing area inside a 300×150 box, leaving room for the axis numbers
  const W = 300;
  const H = 150;
  const PAD = { left: 40, right: 10, top: 10, bottom: 30 };
  const all = $derived([...chart.base, ...chart.value]);
  const xs = $derived(all.map((p) => p[0]));
  const ys = $derived(all.map((p) => p[1]));
  const x0 = $derived(Math.min(...xs));
  const x1 = $derived(Math.max(...xs));
  const y0 = $derived(Math.min(...ys));
  const y1 = $derived(Math.max(...ys));
  const sx = (x: number): number => PAD.left + ((x - x0) / (x1 - x0 || 1)) * (W - PAD.left - PAD.right);
  const sy = (y: number): number => H - PAD.bottom - ((y - y0) / (y1 - y0 || 1)) * (H - PAD.top - PAD.bottom);
  const line = (pts: readonly (readonly [number, number])[]): string => pts.map(([x, y]) => `${String(sx(x))},${String(sy(y))}`).join(' ');
</script>

<figure class="curve-chart">
  <svg class="plot" viewBox={`0 0 ${String(W)} ${String(H)}`} role="img" aria-label={label}>
    <line class="axis" x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} />
    <line class="axis" x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} />
    <text class="tick" x={PAD.left - 4} y={sy(y1) + 4} text-anchor="end">{fmt(y1)}</text>
    <text class="tick" x={PAD.left - 4} y={sy(y0) + 4} text-anchor="end">{fmt(y0)}</text>
    <text class="tick" x={sx(x0)} y={H - PAD.bottom + 13} text-anchor="start">{fmt(x0)}</text>
    <text class="tick" x={sx(x1)} y={H - PAD.bottom + 13} text-anchor="end">{fmt(x1)}</text>
    <text class="name" x={(PAD.left + W - PAD.right) / 2} y={H - 3} text-anchor="middle">{axes[0]}</text>
    <polyline class="before" points={line(chart.base)} />
    <polyline class="after" points={line(chart.value)} />
    {#each chart.value as [x, y], i (i)}<circle class="dot" cx={sx(x)} cy={sy(y)} r="2.5" />{/each}
  </svg>
  <figcaption class="legend">
    <span class="key -before">Before</span><span class="key -after">With this build</span><span class="axis-name">↑ {axes[1]}</span>
  </figcaption>
</figure>

<style lang="scss">
  // A small before/after line chart of one curve: dashed grey before, accent with this build.
  .curve-chart {
    display: grid;
    gap: 4px;
    max-width: 360px;
    margin: 0;
  }

  .curve-chart > .plot {
    width: 100%;
    height: auto;
    overflow: visible;

    .axis {
      stroke: var(--color-line);
    }

    .tick,
    .name {
      fill: var(--color-muted);
      font: 10px var(--font-mono);
    }

    .name {
      font: italic 500 11px var(--font-label);
    }

    .before {
      fill: none;
      stroke: var(--color-muted);
      stroke-dasharray: 4 3;
      stroke-width: 1.5;
    }

    .after {
      fill: none;
      stroke: var(--color-accent);
      stroke-width: 2;
    }

    .dot {
      fill: var(--color-accent);
    }
  }

  .curve-chart > .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    color: var(--color-muted);
    font: italic 500 12px var(--font-label);

    .key::before {
      display: inline-block;
      width: 14px;
      margin-right: 4px;
      vertical-align: middle;
      border-top: 2px solid var(--color-accent);
      content: '';
    }

    .key.-before::before {
      border-top: 2px dashed var(--color-muted);
    }
  }
</style>
