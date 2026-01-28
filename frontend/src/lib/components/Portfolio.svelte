<script lang="ts">
  import { onMount } from 'svelte';
  import { activeStrategy } from '$lib/stores';
  import { tradingApi, type Portfolio as PortfolioData, type Position, type NetWorthPoint } from '$lib/api';

  let portfolio: PortfolioData | null = null;
  let positions: Position[] = [];
  let netWorthHistory: NetWorthPoint[] = [];
  let loading = true;
  let error = '';

  // Chart dimensions
  const chartWidth = 600;
  const chartHeight = 200;
  const chartPadding = { top: 20, right: 20, bottom: 30, left: 60 };

  $: if ($activeStrategy) {
    loadPortfolio();
  }

  async function loadPortfolio() {
    if (!$activeStrategy) return;
    
    loading = true;
    error = '';
    try {
      [portfolio, positions, netWorthHistory] = await Promise.all([
        tradingApi.getPortfolio($activeStrategy.id),
        tradingApi.getPositions($activeStrategy.id),
        tradingApi.getNetWorthHistory($activeStrategy.id),
      ]);
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'An error occurred';
    } finally {
      loading = false;
    }
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(value));
  }

  function formatPercent(value: number): string {
    const num = Number(value);
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  }

  function formatShortCurrency(value: number): string {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }

  function buildSymbolLink(symbol: string): string {
    return `/?symbol=${encodeURIComponent(symbol)}`;
  }

  // Chart helper functions
  $: chartData = netWorthHistory.map(p => ({
    date: new Date(p.recorded_at),
    value: Number(p.net_worth)
  })).sort((a, b) => a.date.getTime() - b.date.getTime());

  $: minValue = chartData.length > 0 ? Math.min(...chartData.map(d => d.value)) * 0.98 : 0;
  $: maxValue = chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) * 1.02 : 100000;
  $: minDate = chartData.length > 0 ? chartData[0].date.getTime() : 0;
  $: maxDate = chartData.length > 0 ? chartData[chartData.length - 1].date.getTime() : 1;

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

  $: linePath = chartData.length > 0
    ? chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.date)} ${scaleY(d.value)}`).join(' ')
    : '';

  $: areaPath = chartData.length > 0
    ? `${linePath} L ${scaleX(chartData[chartData.length - 1].date)} ${chartPadding.top + innerHeight} L ${chartPadding.left} ${chartPadding.top + innerHeight} Z`
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
    if (chartData.length === 0) return [];
    const ticks = [];
    const count = Math.min(5, chartData.length);
    const step = Math.floor(chartData.length / count);
    for (let i = 0; i < chartData.length; i += step) {
      ticks.push(chartData[i]);
    }
    if (chartData.length > 1 && ticks[ticks.length - 1] !== chartData[chartData.length - 1]) {
      ticks.push(chartData[chartData.length - 1]);
    }
    return ticks;
  })();

  $: startValue = chartData.length > 0 ? chartData[0].value : 100000;
  $: endValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 100000;
  $: chartPnl = endValue - startValue;
  $: chartPnlPercent = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
  $: isPositiveChart = chartPnl >= 0;
</script>

<div class="portfolio">
  {#if loading}
    <div class="loading">Loading portfolio...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if portfolio}
    <div class="summary-cards">
      <div class="card">
        <span class="label">Net Worth</span>
        <span class="value">{formatCurrency(portfolio.netWorth)}</span>
      </div>
      <div class="card">
        <span class="label">Cash Balance</span>
        <span class="value">{formatCurrency(portfolio.cashBalance)}</span>
      </div>
      <div class="card">
        <span class="label">Total P&L</span>
        <span class="value" class:positive={portfolio.totalPnl >= 0} class:negative={portfolio.totalPnl < 0}>
          {formatCurrency(portfolio.totalPnl)} ({formatPercent(portfolio.totalPnlPercent)})
        </span>
      </div>
      <div class="card">
        <span class="label">Unrealized P&L</span>
        <span class="value" class:positive={portfolio.unrealizedPnl >= 0} class:negative={portfolio.unrealizedPnl < 0}>
          {formatCurrency(portfolio.unrealizedPnl)}
        </span>
      </div>
    </div>

    <!-- Net Worth Chart -->
    <div class="section chart-section">
      <h3>Performance Over Time</h3>
      {#if chartData.length > 1}
        <div class="chart-container">
          <div class="chart-header">
            <span class="chart-title">Net Worth</span>
            <span class="chart-change" class:positive={isPositiveChart} class:negative={!isPositiveChart}>
              {formatCurrency(chartPnl)} ({formatPercent(chartPnlPercent)})
            </span>
          </div>
          <svg viewBox="0 0 {chartWidth} {chartHeight}" class="equity-chart">
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

            <!-- Data points -->
            {#each chartData as point}
              <circle
                cx={scaleX(point.date)}
                cy={scaleY(point.value)}
                r="3"
                class="chart-point"
                class:positive-point={isPositiveChart}
                class:negative-point={!isPositiveChart}
              />
            {/each}

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
      {:else}
        <div class="empty-small">
          Performance chart will appear after more trading activity.
        </div>
      {/if}
    </div>

    <div class="section">
      <h3>Positions</h3>
      {#if positions.length === 0}
        <div class="empty">No positions yet. Start trading!</div>
      {:else}
        <table class="positions-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Type</th>
              <th>Quantity</th>
              <th>Avg Cost</th>
              <th>Current</th>
              <th>Market Value</th>
              <th>P&L</th>
            </tr>
          </thead>
          <tbody>
            {#each positions as pos}
              <tr>
                <td class="symbol">
                  <a class="symbol-link" href={buildSymbolLink(pos.symbol)}>{pos.symbol}</a>
                </td>
                <td>{pos.asset_type}</td>
                <td>{Number(pos.quantity).toFixed(4)}</td>
                <td>{formatCurrency(Number(pos.average_cost))}</td>
                <td>{formatCurrency(pos.currentPrice ?? 0)}</td>
                <td>{formatCurrency(pos.marketValue ?? 0)}</td>
                <td class:positive={(pos.unrealizedPnl ?? 0) >= 0} class:negative={(pos.unrealizedPnl ?? 0) < 0}>
                  {formatCurrency(pos.unrealizedPnl ?? 0)} ({formatPercent(pos.unrealizedPnlPercent ?? 0)})
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

    <div class="section allocations">
      <div class="allocation-card">
        <h4>By Asset Type</h4>
        <div class="allocation-list">
          {#each Object.entries(portfolio.allocationByType ?? {}) as [type, value]}
            <div class="allocation-item">
              <span class="type">{type}</span>
              <span class="amount">{formatCurrency(value as number)}</span>
            </div>
          {/each}
          {#if Object.keys(portfolio.allocationByType ?? {}).length === 0}
            <div class="empty-small">No allocations</div>
          {/if}
        </div>
      </div>
      
      <div class="allocation-card">
        <h4>By Currency</h4>
        <div class="allocation-list">
          {#each Object.entries(portfolio.allocationByCurrency ?? {}) as [currency, value]}
            <div class="allocation-item">
              <span class="type">{currency}</span>
              <span class="amount">{formatCurrency(value as number)}</span>
            </div>
          {/each}
          {#if Object.keys(portfolio.allocationByCurrency ?? {}).length === 0}
            <div class="empty-small">No allocations</div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .portfolio {
    padding: 1rem;
  }

  .loading, .error {
    text-align: center;
    padding: 2rem;
    color: #666;
  }

  .error {
    color: #dc3545;
  }

  .summary-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .card {
    background: white;
    padding: 1.25rem;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .card .label {
    display: block;
    font-size: 0.75rem;
    color: #666;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }

  .card .value {
    font-size: 1.5rem;
    font-weight: 600;
  }

  .positive {
    color: #28a745;
  }

  .negative {
    color: #dc3545;
  }

  .section {
    margin-bottom: 2rem;
  }

  .section h3 {
    font-size: 1.25rem;
    margin-bottom: 1rem;
  }

  .empty, .empty-small {
    text-align: center;
    color: #666;
    padding: 2rem;
    background: #f8f9fa;
    border-radius: 8px;
  }

  .empty-small {
    padding: 1rem;
    font-size: 0.875rem;
  }

  .positions-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .positions-table th,
  .positions-table td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid #eee;
  }

  .positions-table th {
    background: #f8f9fa;
    font-size: 0.75rem;
    text-transform: uppercase;
    color: #666;
    font-weight: 600;
  }

  .positions-table .symbol {
    font-weight: 600;
    color: #007bff;
  }

  .symbol-link {
    color: inherit;
    text-decoration: none;
  }

  .symbol-link:hover {
    text-decoration: underline;
  }

  .allocations {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .allocation-card {
    background: white;
    padding: 1rem;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .allocation-card h4 {
    font-size: 0.875rem;
    margin: 0 0 0.75rem 0;
    color: #666;
  }

  .allocation-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .allocation-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #eee;
  }

  .allocation-item:last-child {
    border-bottom: none;
  }

  .allocation-item .type {
    text-transform: capitalize;
  }

  .allocation-item .amount {
    font-weight: 500;
  }

  /* Chart styles */
  .chart-section {
    margin-bottom: 2rem;
  }

  .chart-container {
    background: white;
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .chart-title {
    font-weight: 600;
    color: #333;
  }

  .chart-change {
    font-weight: 500;
    font-size: 0.875rem;
  }

  .equity-chart {
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

  .chart-point {
    fill: white;
    stroke-width: 2;
  }

  .chart-point.positive-point {
    stroke: #28a745;
  }

  .chart-point.negative-point {
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

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .portfolio {
      padding: 0.5rem;
    }

    .summary-cards {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }

    .card {
      padding: 0.875rem;
    }

    .card .value {
      font-size: 1.1rem;
    }

    .card .label {
      font-size: 0.65rem;
    }

    .positions-table {
      display: block;
      overflow-x: auto;
    }

    .positions-table th,
    .positions-table td {
      padding: 0.5rem;
      font-size: 0.8rem;
      white-space: nowrap;
    }

    .section h3 {
      font-size: 1.1rem;
    }
  }

  @media (max-width: 480px) {
    .summary-cards {
      grid-template-columns: 1fr 1fr;
    }

    .card .value {
      font-size: 0.95rem;
    }

    .allocations {
      grid-template-columns: 1fr;
    }

    .chart-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
  }
</style>
