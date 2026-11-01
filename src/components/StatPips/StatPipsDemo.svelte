<script lang="ts">
  import StatPips from './StatPips.svelte';

  // Showcase wrapper: interactive pips need state, which a static .astro page can't hold.
  let level = $state(6);
</script>

<div class="pips-demo">
  <span class="name">Cornering</span>
  <StatPips {level} label="Cornering" onchange={(n: number) => { level = n; }} />
  <output class="value">{level}</output>
</div>

<style lang="scss">
  .pips-demo {
    display: grid;
    grid-template-columns: 110px minmax(0, 1fr) 26px;
    gap: var(--space-3);
    align-items: center;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--color-teal);
    color: var(--color-on-teal);
  }

  .pips-demo > .name {
    font-weight: 600;
  }

  .pips-demo > .value {
    font: 800 16px var(--font-display);
    text-align: right;
  }
</style>
