<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { marketApi, type MostActiveQuote } from '$lib/api';

  let loading = true;
  let error = '';
  let actives: MostActiveQuote[] = [];

  const count = 25;

  onMount(async () => {
    await loadActives();
  });

  async function loadActives() {
    loading = true;
    error = '';
    try {
      actives = await marketApi.getMostActives(count);
    } catch (e: any) {
      error = e.message || 'Unable to load most active stocks';
    } finally {
      loading = false;
    }
  }

  function viewSymbol(symbol: string) {
    goto(`/stock/${encodeURIComponent(symbol)}`);
  }

  function formatCurrency(value: number | null): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    }).format(value);
  }

  function formatNumber(value: number | null): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('en-US').format(value);
  }

  function formatPercent(value: number | null): string {
    if (value == null) return '—';
    const num = Number(value);
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  }
</script>

<section class="overview">
  <div class="overview-header">
    <div>
      <h3>Top Trading Stocks</h3>
      <p class="subhead">Most active by volume (Yahoo Finance)</p>
    </div>
    <button class="refresh-btn" onclick={loadActives} disabled={loading}>
      {loading ? 'Refreshing…' : 'Refresh'}
    </button>
  </div>

  {#if loading}
    <div class="loading">Loading most active stocks…</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if actives.length === 0}
    <div class="empty">No data available.</div>
  {:else}
    <div class="table-wrap">
      <table class="actives-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Name</th>
            <th>Price</th>
            <th>Change</th>
            <th>Volume</th>
            <th>Market Cap</th>
          </tr>
        </thead>
        <tbody>
          {#each actives as quote}
            <tr class="row" onclick={() => viewSymbol(quote.symbol)}>
              <td class="symbol">
                <span class="ticker">{quote.symbol}</span>
                {#if quote.exchange}
                  <span class="exchange">{quote.exchange}</span>
                {/if}
              </td>
              <td class="name">{quote.shortName || quote.longName || quote.symbol}</td>
              <td>{formatCurrency(quote.price)}</td>
              <td class:positive={(quote.change ?? 0) >= 0} class:negative={(quote.change ?? 0) < 0}>
                {quote.change != null ? formatCurrency(quote.change) : '—'} ({formatPercent(quote.changePercent)})
              </td>
              <td>{formatNumber(quote.volume)}</td>
              <td>{formatCurrency(quote.marketCap)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  .overview {
    margin-bottom: 2rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    padding: 1.5rem;
  }

  .overview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  .subhead {
    margin: 0.25rem 0 0 0;
    color: #666;
    font-size: 0.875rem;
  }

  .refresh-btn {
    border: 1px solid #ddd;
    background: white;
    border-radius: 999px;
    padding: 0.4rem 0.85rem;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .refresh-btn:hover:not(:disabled) {
    border-color: #007bff;
    color: #007bff;
  }

  .refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loading, .error, .empty {
    text-align: center;
    padding: 1.5rem;
    color: #666;
    background: #f8f9fa;
    border-radius: 8px;
  }

  .error {
    color: #dc3545;
  }

  .table-wrap {
    overflow-x: auto;
  }

  .actives-table {
    width: 100%;
    border-collapse: collapse;
  }

  .actives-table th,
  .actives-table td {
    padding: 0.75rem 0.5rem;
    text-align: left;
    border-bottom: 1px solid #eee;
    white-space: nowrap;
  }

  .actives-table th {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #666;
  }

  .row {
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .row:hover {
    background: rgba(0, 123, 255, 0.05);
  }

  .symbol {
    font-weight: 600;
  }

  .ticker {
    display: block;
  }

  .exchange {
    display: block;
    font-size: 0.7rem;
    color: #888;
  }

  .name {
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .positive {
    color: #28a745;
  }

  .negative {
    color: #dc3545;
  }

  @media (max-width: 768px) {
    .overview {
      padding: 1rem;
    }

    .overview-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .actives-table th,
    .actives-table td {
      padding: 0.6rem 0.4rem;
      font-size: 0.85rem;
    }
  }
</style>
