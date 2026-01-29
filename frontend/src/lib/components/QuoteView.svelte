<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { marketApi, createQuoteStream, type ProfileSummary } from '$lib/api';

  export let symbol: string;
  export let showChart = true;

  let quote: any = null;
  let profile: ProfileSummary | null = null;
  let chartData: any[] = [];
  let loading = true;
  let error = '';
  let quoteStream: ReturnType<typeof createQuoteStream> | null = null;
  let pricePulse = false;
  let pulseTimer: ReturnType<typeof setTimeout> | null = null;

  // Chart dimensions
  const chartWidth = 600;
  const chartHeight = 200;
  const chartPadding = { top: 20, right: 20, bottom: 30, left: 60 };

  onMount(async () => {
    await loadData();
    setupStream();
  });

  onDestroy(() => {
    if (quoteStream) {
      quoteStream.unsubscribe(symbol);
      quoteStream.close();
    }
    if (pulseTimer) {
      clearTimeout(pulseTimer);
    }
  });

  async function loadData() {
    loading = true;
    error = '';
    try {
      quote = await marketApi.getQuote(symbol);
      if (showChart) {
        chartData = await marketApi.getChart(symbol);
      }
      try {
        profile = await marketApi.getProfile(symbol);
      } catch {
        profile = null;
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function setupStream() {
    quoteStream = createQuoteStream((newQuote) => {
      if (newQuote.symbol === symbol) {
        const prevPrice = quote?.price;
        quote = newQuote;
        if (prevPrice != null && newQuote.price !== prevPrice) {
          triggerPulse();
        }
      }
    });
    quoteStream.subscribe(symbol);
  }

  function triggerPulse() {
    pricePulse = true;
    if (pulseTimer) {
      clearTimeout(pulseTimer);
    }
    pulseTimer = setTimeout(() => {
      pricePulse = false;
    }, 450);
  }

  $: priceClass = quote?.change >= 0 ? 'positive' : 'negative';

  function getMarketStatus(state?: string | null): { label: string; className: string } | null {
    if (!state) return null;
    switch (state) {
      case 'REGULAR':
        return { label: 'Market Open', className: 'open' };
      case 'CLOSED':
        return { label: 'Market Closed', className: 'closed' };
      case 'PRE':
      case 'PREPRE':
        return { label: 'Pre-market', className: 'extended' };
      case 'POST':
      case 'POSTPOST':
        return { label: 'After-hours', className: 'extended' };
      default:
        return { label: `Market ${state.toLowerCase()}`, className: 'neutral' };
    }
  }

  $: marketStatus = getMarketStatus(quote?.marketState);

  // Chart helper functions
  $: chartBars = chartData
    .map((p) => ({
      ...p,
      date: new Date(p.timestamp),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  $: latestBar = chartBars.length > 0 ? chartBars[chartBars.length - 1] : null;
  $: previousBar = chartBars.length > 1 ? chartBars[chartBars.length - 2] : null;

  $: displayName = profile?.longName || profile?.shortName || quote?.symbol;

  $: chartPoints = chartBars
    .map((p) => ({
      date: p.date,
      value: Number(p.close),
    }))
    .filter((p) => !Number.isNaN(p.value))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  $: minValue = chartPoints.length > 0 ? Math.min(...chartPoints.map((d) => d.value)) * 0.98 : 0;
  $: maxValue = chartPoints.length > 0 ? Math.max(...chartPoints.map((d) => d.value)) * 1.02 : 1;
  $: minDate = chartPoints.length > 0 ? chartPoints[0].date.getTime() : 0;
  $: maxDate = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1].date.getTime() : 1;

  $: innerWidth = chartWidth - chartPadding.left - chartPadding.right;
  $: innerHeight = chartHeight - chartPadding.top - chartPadding.bottom;

  function scaleX(date: Date): number {
    if (maxDate === minDate) return chartPadding.left + innerWidth / 2;
    return chartPadding.left + ((date.getTime() - minDate) / (maxDate - minDate)) * innerWidth;
  }

  function scaleY(value: number): number {
    if (maxValue === minValue) return chartPadding.top + innerHeight / 2;
    return chartPadding.top + innerHeight - ((value - minValue) / (maxValue - minValue)) * innerHeight;
  }

  $: linePath = chartPoints.length > 0
    ? chartPoints.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.date)} ${scaleY(d.value)}`).join(' ')
    : '';

  $: areaPath = chartPoints.length > 0
    ? `${linePath} L ${scaleX(chartPoints[chartPoints.length - 1].date)} ${chartPadding.top + innerHeight} L ${chartPadding.left} ${chartPadding.top + innerHeight} Z`
    : '';

  $: yAxisTicks = (() => {
    const ticks = [];
    const range = maxValue - minValue;
    const step = range / 4;
    for (let i = 0; i <= 4; i++) {
      ticks.push(minValue + step * i);
    }
    return ticks;
  })();

  $: xAxisTicks = (() => {
    if (chartPoints.length === 0) return [];
    const ticks = [];
    const count = Math.min(5, chartPoints.length);
    const step = Math.floor(chartPoints.length / count);
    for (let i = 0; i < chartPoints.length; i += step) {
      ticks.push(chartPoints[i]);
    }
    if (chartPoints.length > 1 && ticks[ticks.length - 1] !== chartPoints[chartPoints.length - 1]) {
      ticks.push(chartPoints[chartPoints.length - 1]);
    }
    return ticks;
  })();

  $: startValue = chartPoints.length > 0 ? chartPoints[0].value : 0;
  $: endValue = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1].value : 0;
  $: isPositiveChart = endValue - startValue >= 0;

  function formatShortCurrency(value: number): string {
    if (value >= 1000) return `$${value.toFixed(0)}`;
    return `$${value.toFixed(2)}`;
  }
</script>

<div class="quote-view">
  {#if loading}
    <div class="loading">Loading quote...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if quote}
    <div class="quote-header">
      <div class="symbol-row">
        <h2 class="symbol">{displayName}</h2>
        <a
          class="yahoo-link"
          href={`https://finance.yahoo.com/quote/${encodeURIComponent(quote.symbol)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Yahoo Finance ↗
        </a>
        {#if marketStatus}
          <span class="market-pill {marketStatus.className}">{marketStatus.label}</span>
        {/if}
      </div>
      {#if profile?.description}
        <p class="description">{profile.description}</p>
      {/if}
      <div class="price-container" class:pulse={pricePulse}>
        <span class="price">${Number(quote.price).toFixed(2)}</span>
        <span class="change {priceClass}">
          {quote.change >= 0 ? '+' : ''}{Number(quote.change).toFixed(2)}
          ({Number(quote.changePercent).toFixed(2)}%)
        </span>
      </div>
    </div>

    {#if showChart && chartPoints.length > 0}
      <div class="chart-container">
        <svg viewBox="0 0 {chartWidth} {chartHeight}" class="price-chart">
          <!-- Grid lines -->
          {#each yAxisTicks as tick}
            <line
              x1={chartPadding.left}
              y1={scaleY(tick)}
              x2={chartWidth - chartPadding.right}
              y2={scaleY(tick)}
              class="grid-line"
            />
          {/each}

          <!-- Area fill -->
          <path d={areaPath} class="chart-area" class:positive-area={isPositiveChart} class:negative-area={!isPositiveChart} />

          <!-- Line -->
          <path d={linePath} class="chart-line" class:positive-line={isPositiveChart} class:negative-line={!isPositiveChart} />

          <!-- Y-axis labels -->
          {#each yAxisTicks as tick}
            <text
              x={chartPadding.left - 8}
              y={scaleY(tick)}
              class="axis-label y-label"
            >
              {formatShortCurrency(tick)}
            </text>
          {/each}

          <!-- X-axis labels -->
          {#each xAxisTicks as point}
            <text
              x={scaleX(point.date)}
              y={chartHeight - 8}
              class="axis-label x-label"
            >
              {point.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </text>
          {/each}
        </svg>
      </div>
    {/if}

    <div class="quote-details">
      <div class="detail">
        <span class="label">Volume</span>
        <span class="value">{quote.volume?.toLocaleString() || 'N/A'}</span>
      </div>
      {#if latestBar}
        <div class="detail">
          <span class="label">Open</span>
          <span class="value">${Number(latestBar.open).toFixed(2)}</span>
        </div>
        <div class="detail">
          <span class="label">High</span>
          <span class="value">${Number(latestBar.high).toFixed(2)}</span>
        </div>
        <div class="detail">
          <span class="label">Low</span>
          <span class="value">${Number(latestBar.low).toFixed(2)}</span>
        </div>
        <div class="detail">
          <span class="label">Close</span>
          <span class="value">${Number(latestBar.close).toFixed(2)}</span>
        </div>
      {/if}
      {#if previousBar}
        <div class="detail">
          <span class="label">Prev Close</span>
          <span class="value">${Number(previousBar.close).toFixed(2)}</span>
        </div>
      {/if}
      {#if profile?.sector}
        <div class="detail">
          <span class="label">Sector</span>
          <span class="value">{profile.sector}</span>
        </div>
      {/if}
      {#if profile?.industry}
        <div class="detail">
          <span class="label">Industry</span>
          <span class="value">{profile.industry}</span>
        </div>
      {/if}
      {#if profile?.fullTimeEmployees}
        <div class="detail">
          <span class="label">Employees</span>
          <span class="value">{profile.fullTimeEmployees.toLocaleString()}</span>
        </div>
      {/if}
      {#if profile?.website}
        <div class="detail">
          <span class="label">Website</span>
          <a class="value link" href={profile.website} target="_blank" rel="noopener noreferrer">
            {profile.website.replace(/^https?:\/\//, '')}
          </a>
        </div>
      {/if}
      {#if marketStatus}
        <div class="detail">
          <span class="label">Market Status</span>
          <span class="value">{marketStatus.label}</span>
        </div>
      {/if}
      {#if quote?.regularMarketTime}
        <div class="detail">
          <span class="label">Market Time</span>
          <span class="value">{new Date(quote.regularMarketTime).toLocaleString()}</span>
        </div>
      {/if}
      <div class="detail">
        <span class="label">Last Updated</span>
        <span class="value">{quote.timestamp}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .quote-view {
    padding: 1rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .loading, .error {
    padding: 2rem;
    text-align: center;
    color: #666;
  }

  .error {
    color: #dc3545;
  }

  .quote-header {
    margin-bottom: 1rem;
  }

  .symbol-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }

  .symbol {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }

  .yahoo-link {
    font-size: 0.875rem;
    color: #007bff;
    text-decoration: none;
    border: 1px solid #dbe7ff;
    background: #f7faff;
    padding: 0.25rem 0.5rem;
    border-radius: 999px;
    transition: all 0.15s ease;
  }

  .yahoo-link:hover {
    border-color: #007bff;
    background: #eef5ff;
  }

  .market-pill {
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    border: 1px solid #ddd;
    background: #f8f9fa;
    color: #555;
  }

  .market-pill.open {
    border-color: #28a745;
    color: #1f7a33;
    background: #e6f4ea;
  }

  .market-pill.closed {
    border-color: #dc3545;
    color: #a71d2a;
    background: #fdeaea;
  }

  .market-pill.extended {
    border-color: #ffb347;
    color: #9b5b00;
    background: #fff3e0;
  }

  .market-pill.neutral {
    border-color: #bbb;
    color: #555;
  }

  .price-container {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
  }

  .price-container.pulse {
    animation: price-pulse 0.45s ease;
  }

  .price {
    font-size: 2rem;
    font-weight: 700;
  }

  .change {
    font-size: 1rem;
    font-weight: 500;
  }

  .change.positive {
    color: #28a745;
  }

  .change.negative {
    color: #dc3545;
  }

  @keyframes price-pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.35);
    }
    60% {
      box-shadow: 0 0 0 8px rgba(0, 123, 255, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(0, 123, 255, 0);
    }
  }

  .description {
    margin: 0 0 0.75rem 0;
    color: #555;
    line-height: 1.4;
    font-size: 0.95rem;
  }

  .chart-container {
    margin: 1rem 0;
    background: #f8f9fa;
    border-radius: 4px;
    padding: 1rem;
  }

  .price-chart {
    width: 100%;
    height: auto;
    display: block;
  }

  .grid-line {
    stroke: #e9ecef;
    stroke-width: 1;
  }

  .chart-area {
    fill-opacity: 0.1;
  }

  .chart-area.positive-area {
    fill: #28a745;
  }

  .chart-area.negative-area {
    fill: #dc3545;
  }

  .chart-line {
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .chart-line.positive-line {
    stroke: #28a745;
  }

  .chart-line.negative-line {
    stroke: #dc3545;
  }

  .axis-label {
    font-size: 10px;
    fill: #666;
  }

  .y-label {
    text-anchor: end;
    dominant-baseline: middle;
  }

  .x-label {
    text-anchor: middle;
  }

  .quote-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem 1.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #eee;
  }

  .detail {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .detail .label {
    font-size: 0.75rem;
    color: #666;
    text-transform: uppercase;
  }

  .detail .value {
    font-weight: 500;
  }

  .detail .value.link {
    color: #007bff;
    text-decoration: none;
  }

  .detail .value.link:hover {
    text-decoration: underline;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .quote-view {
      padding: 1rem;
    }

    .header {
      flex-wrap: wrap;
      gap: 0.25rem;
    }

    .symbol {
      font-size: 1.5rem;
    }

    .price {
      font-size: 1.5rem;
    }

    .chart-container {
      padding: 0.75rem;
    }

    .quote-details {
      flex-wrap: wrap;
      gap: 1rem;
    }

    .detail {
      flex: 1;
      min-width: 80px;
    }
  }
</style>
