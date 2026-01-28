<script lang="ts">
  import { onMount } from 'svelte';
  import { activeStrategy } from '$lib/stores';
  import { tradingApi } from '$lib/api';

  let portfolio: any = null;
  let positions: any[] = [];
  let loading = true;
  let error = '';

  $: if ($activeStrategy) {
    loadPortfolio();
  }

  async function loadPortfolio() {
    if (!$activeStrategy) return;
    
    loading = true;
    error = '';
    try {
      [portfolio, positions] = await Promise.all([
        tradingApi.getPortfolio($activeStrategy.id),
        tradingApi.getPositions($activeStrategy.id),
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
    }).format(Number(value));
  }

  function formatPercent(value: number): string {
    const num = Number(value);
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  }
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
                <td class="symbol">{pos.symbol}</td>
                <td>{pos.asset_type}</td>
                <td>{Number(pos.quantity).toFixed(4)}</td>
                <td>{formatCurrency(Number(pos.average_cost))}</td>
                <td>{formatCurrency(pos.currentPrice)}</td>
                <td>{formatCurrency(pos.marketValue)}</td>
                <td class:positive={pos.unrealizedPnl >= 0} class:negative={pos.unrealizedPnl < 0}>
                  {formatCurrency(pos.unrealizedPnl)} ({formatPercent(pos.unrealizedPnlPercent)})
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
          {#each Object.entries(portfolio.allocationByType) as [type, value]}
            <div class="allocation-item">
              <span class="type">{type}</span>
              <span class="amount">{formatCurrency(value as number)}</span>
            </div>
          {/each}
          {#if Object.keys(portfolio.allocationByType).length === 0}
            <div class="empty-small">No allocations</div>
          {/if}
        </div>
      </div>
      
      <div class="allocation-card">
        <h4>By Currency</h4>
        <div class="allocation-list">
          {#each Object.entries(portfolio.allocationByCurrency) as [currency, value]}
            <div class="allocation-item">
              <span class="type">{currency}</span>
              <span class="amount">{formatCurrency(value as number)}</span>
            </div>
          {/each}
          {#if Object.keys(portfolio.allocationByCurrency).length === 0}
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
</style>
