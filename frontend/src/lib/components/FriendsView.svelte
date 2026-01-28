<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { userApi, tradingApi, type User, type Strategy, type Portfolio, type Position, type NetWorthPoint } from '$lib/api';

  // Props for direct navigation from leaderboard
  export let userId: string | null = null;
  export let strategyId: string | null = null;

  let users: User[] = [];
  let selectedUser: User | null = null;
  let strategies: Strategy[] = [];
  let selectedStrategy: Strategy | null = null;
  let portfolio: Portfolio | null = null;
  let positions: Position[] = [];
  let netWorthHistory: NetWorthPoint[] = [];
  let loading = false;
  let error = '';

  // Chart dimensions
  const chartWidth = 600;
  const chartHeight = 200;
  const chartPadding = { top: 20, right: 20, bottom: 30, left: 60 };

  onMount(async () => {
    await loadUsers();
    
    // If navigating from leaderboard with userId and strategyId
    if (userId && strategyId) {
      const user = users.find(u => u.id === parseInt(userId));
      if (user) {
        await selectUser(user);
        const strategy = strategies.find(s => s.id === parseInt(strategyId));
        if (strategy) {
          await selectStrategy(strategy);
        }
      }
    }
  });

  async function loadUsers() {
    loading = true;
    try {
      users = await userApi.getAllUsers();
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'An error occurred';
    } finally {
      loading = false;
    }
  }

  async function selectUser(user: User) {
    selectedUser = user;
    selectedStrategy = null;
    portfolio = null;
    positions = [];
    netWorthHistory = [];
    
    loading = true;
    try {
      strategies = await userApi.getUserStrategies(user.id);
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'An error occurred';
    } finally {
      loading = false;
    }
  }

  async function selectStrategy(strategy: Strategy) {
    selectedStrategy = strategy;
    
    loading = true;
    try {
      [portfolio, positions, netWorthHistory] = await Promise.all([
        tradingApi.getPortfolio(strategy.id),
        tradingApi.getPositions(strategy.id),
        tradingApi.getNetWorthHistory(strategy.id),
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
    }).format(value);
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

  function goBack() {
    if (selectedStrategy) {
      selectedStrategy = null;
      portfolio = null;
      positions = [];
      netWorthHistory = [];
      // Clear URL params when going back
      goto('/friends', { replaceState: true });
    } else if (selectedUser) {
      selectedUser = null;
      strategies = [];
    }
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

<div class="friends-view">
  <div class="header">
    {#if selectedUser}
      <button class="back-btn" onclick={goBack}>← Back</button>
    {/if}
    <h2>
      {#if selectedStrategy}
        {selectedUser?.display_name || 'User'}'s Strategy {selectedStrategy.name}
      {:else if selectedUser}
        {selectedUser?.display_name || 'User'}'s Strategies
      {:else}
        Friends
      {/if}
    </h2>
  </div>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if !selectedUser}
    <!-- User List -->
    <div class="user-list">
      {#each users as user}
        <button class="user-card" onclick={() => selectUser(user)}>
          <div class="avatar">{user.display_name ? user.display_name.charAt(0).toUpperCase() : '?'}</div>
          <div class="info">
            <span class="name">{user.display_name || user.email || 'Unknown'}</span>
            <span class="email">{user.email || ''}</span>
          </div>
        </button>
      {/each}
      {#if users.length === 0}
        <div class="empty">No friends yet.</div>
      {/if}
    </div>
  {:else if !selectedStrategy}
    <!-- Strategy List -->
    <div class="strategy-list">
      {#each strategies as strategy}
        <button class="strategy-card" onclick={() => selectStrategy(strategy)}>
          <span class="name">Strategy {strategy.name}</span>
          <span class="balance">Cash: {formatCurrency(strategy.cash_balance)}</span>
        </button>
      {/each}
    </div>
  {:else if portfolio}
    <!-- Portfolio View (Read-only) -->
    <div class="portfolio-view">
      <div class="summary-cards">
        <div class="card">
          <span class="label">Net Worth</span>
          <span class="value">{formatCurrency(portfolio.netWorth)}</span>
        </div>
        <div class="card">
          <span class="label">Total P&L</span>
          <span class="value" class:positive={portfolio.totalPnl >= 0} class:negative={portfolio.totalPnl < 0}>
            {formatCurrency(portfolio.totalPnl)} ({formatPercent(portfolio.totalPnlPercent)})
          </span>
        </div>
      </div>

      <div class="section">
        <h3>Holdings</h3>
        {#if positions.length === 0}
          <div class="empty-small">No positions</div>
        {:else}
          <table class="positions-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Quantity</th>
                <th>Market Value</th>
                <th>P&L</th>
              </tr>
            </thead>
            <tbody>
              {#each positions as pos}
                <tr>
                  <td class="symbol">{pos.symbol}</td>
                  <td>{Number(pos.quantity).toFixed(4)}</td>
                  <td>{formatCurrency(pos.marketValue ?? 0)}</td>
                  <td class:positive={(pos.unrealizedPnl ?? 0) >= 0} class:negative={(pos.unrealizedPnl ?? 0) < 0}>
                    {formatCurrency(pos.unrealizedPnl ?? 0)}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>

      <div class="section">
        <h3>Net Worth Over Time</h3>
        {#if chartData.length > 1}
          <div class="chart-container">
            <div class="chart-header">
              <span class="chart-title">Performance</span>
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
          <div class="empty-small">No history available yet</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .friends-view {
    padding: 1rem;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .back-btn {
    padding: 0.5rem 1rem;
    background: none;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
  }

  .loading, .error, .empty {
    text-align: center;
    padding: 2rem;
    color: #666;
  }

  .error {
    color: #dc3545;
  }

  .user-list, .strategy-list {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  }

  .user-card, .strategy-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: white;
    border: 1px solid #eee;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .user-card:hover, .strategy-card:hover {
    border-color: #007bff;
    box-shadow: 0 2px 8px rgba(0, 123, 255, 0.15);
  }

  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #007bff;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .name {
    font-weight: 600;
  }

  .email {
    font-size: 0.875rem;
    color: #666;
  }

  .strategy-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .strategy-card .name {
    font-size: 1.25rem;
  }

  .strategy-card .balance {
    color: #666;
  }

  .portfolio-view .summary-cards {
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
    font-size: 1.125rem;
    margin-bottom: 1rem;
  }

  .empty-small {
    text-align: center;
    padding: 1rem;
    color: #666;
    background: #f8f9fa;
    border-radius: 8px;
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
  }

  .positions-table .symbol {
    font-weight: 600;
    color: #007bff;
  }

  /* Chart styles */
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
    .friends-view {
      padding: 0.5rem;
    }

    .header {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .header h2 {
      font-size: 1.2rem;
    }

    .back-btn {
      padding: 0.375rem 0.75rem;
      font-size: 0.875rem;
    }

    .user-list, .strategy-list {
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 0.75rem;
    }

    .user-card, .strategy-card {
      padding: 0.75rem;
    }

    .avatar {
      width: 40px;
      height: 40px;
      font-size: 1rem;
    }

    .name {
      font-size: 0.9rem;
    }

    .email {
      font-size: 0.75rem;
    }

    .portfolio-view .summary-cards {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }

    .card {
      padding: 0.875rem;
    }

    .card .value {
      font-size: 1.1rem;
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
  }

  @media (max-width: 480px) {
    .user-list, .strategy-list {
      grid-template-columns: 1fr;
    }

    .card .value {
      font-size: 0.95rem;
    }

    .chart-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
  }
</style>
