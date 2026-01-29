<script lang="ts">
  export let entries: Array<{ label: string; value: number; color?: string }> = [];
  export let size = 160;

  const palette = [
    '#2b8cbe',
    '#41b6c4',
    '#7fcdbb',
    '#c7e9b4',
    '#fed976',
    '#fdae6b',
    '#f46d43',
    '#d53e4f',
    '#9e0142',
  ];

  const center = 60;
  const radius = 50;

  function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians),
    };
  }

  function describeArc(startAngle: number, endAngle: number) {
    const start = polarToCartesian(center, center, radius, endAngle);
    const end = polarToCartesian(center, center, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return [
      'M',
      start.x,
      start.y,
      'A',
      radius,
      radius,
      0,
      largeArcFlag,
      0,
      end.x,
      end.y,
      'L',
      center,
      center,
      'Z',
    ].join(' ');
  }

  $: filteredEntries = entries.filter((entry) => entry.value > 0);
  $: total = filteredEntries.reduce((sum, entry) => sum + entry.value, 0);

  $: slices = (() => {
    if (total <= 0) return [];
    let cumulative = 0;
    return filteredEntries.map((entry, index) => {
      const startAngle = cumulative;
      const sliceAngle = (entry.value / total) * 360;
      const endAngle = cumulative + sliceAngle;
      cumulative = endAngle;
      return {
        ...entry,
        color: entry.color || palette[index % palette.length],
        path: describeArc(startAngle, endAngle),
      };
    });
  })();
</script>

<div class="pie-wrapper">
  {#if total <= 0}
    <div class="pie-empty">No data</div>
  {:else}
    <svg class="pie" viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      {#each slices as slice}
        <path d={slice.path} fill={slice.color} />
      {/each}
    </svg>
    <div class="legend">
      {#each slices as slice}
        <div class="legend-item">
          <span class="swatch" style={`background:${slice.color}`}></span>
          <span class="label">{slice.label}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .pie-wrapper {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .pie {
    flex: 0 0 auto;
  }

  .legend {
    display: grid;
    gap: 0.4rem 0.75rem;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    flex: 1;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: #555;
  }

  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    display: inline-block;
  }

  .pie-empty {
    color: #777;
    font-size: 0.9rem;
    padding: 0.5rem 0;
  }
</style>
