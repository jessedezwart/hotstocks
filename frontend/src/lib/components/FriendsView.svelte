<script lang="ts">
  import { onMount } from 'svelte';
  import { userApi, tradingApi } from '$lib/api';

  let users: any[] = [];
  let selectedUser: any = null;
  let strategies: any[] = [];
  let selectedStrategy: any = null;
  let portfolio: any = null;
  let positions: any[] = [];
  let netWorthHistory: any[] = [];
  let loading = false;
  let error = '';

  onMount(async () => {
    await loadUsers();
  });

  async function loadUsers() {
    loading = true;
    try {
      users = await userApi.getAllUsers();
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function selectUser(user: any) {
    selectedUser = user;
    selectedStrategy = null;
    portfolio = null;
    positions = [];
    netWorthHistory = [];
    
    loading = true;
    try {
      strategies = await userApi.getUserStrategies(user.id);
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function selectStrategy(strategy: any) {
    selectedStrategy = strategy;
    
    loading = true;
    try {
      [portfolio, positions, netWorthHistory] = await Promise.all([
        tradingApi.getPortfolio(strategy.id),
        tradingApi.getPositions(strategy.id),
        tradingApi.getNetWorthHistory(strategy.id),
      ]);
    } catch (e: any) {
      error = e.message;
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

  function goBack() {
    if (selectedStrategy) {
      selectedStrategy = null;
      portfolio = null;
      positions = [];
    } else if (selectedUser) {
      selectedUser = null;
      strategies = [];
    }
  }
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
                  <td>{pos.quantity.toFixed(4)}</td>
                  <td>{formatCurrency(pos.marketValue)}</td>
                  <td class:positive={pos.unrealizedPnl >= 0} class:negative={pos.unrealizedPnl < 0}>
                    {formatCurrency(pos.unrealizedPnl)}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>

      <div class="section">
        <h3>Net Worth Over Time</h3>
        <div class="chart-placeholder">
          {#if netWorthHistory.length > 0}
            <!-- Chart would go here -->
            <div class="chart-data">
              {#each netWorthHistory.slice(-10) as point}
                <div class="data-point">
                  <span class="date">{new Date(point.recorded_at).toLocaleDateString()}</span>
                  <span class="worth">{formatCurrency(point.net_worth)}</span>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-small">No history available</div>
          {/if}
        </div>
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

  .chart-placeholder {
    background: white;
    padding: 1rem;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .chart-data {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .data-point {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    background: #f8f9fa;
    border-radius: 4px;
  }

  .data-point .date {
    color: #666;
    font-size: 0.875rem;
  }

  .data-point .worth {
    font-weight: 500;
  }
</style>
