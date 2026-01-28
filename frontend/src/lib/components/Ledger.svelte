<script lang="ts">
  import { onMount } from 'svelte';
  import { activeStrategy } from '$lib/stores';
  import { ledgerApi } from '$lib/api';

  let entries: any[] = [];
  let total = 0;
  let loading = true;
  let error = '';
  let page = 0;
  const limit = 50;

  $: if ($activeStrategy) {
    loadLedger();
  }

  async function loadLedger() {
    if (!$activeStrategy) return;
    
    loading = true;
    error = '';
    try {
      const result = await ledgerApi.getEntries($activeStrategy.id, limit, page * limit);
      entries = result.entries;
      total = result.total;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function exportCsv() {
    if (!$activeStrategy) return;
    
    try {
      const blob = await ledgerApi.exportCsv($activeStrategy.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger-strategy-${$activeStrategy.name}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      error = e.message;
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  function getEntryTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      fill: 'Trade Fill',
      commission: 'Commission',
      adjustment: 'Adjustment',
      deposit: 'Deposit',
      withdrawal: 'Withdrawal',
    };
    return labels[type] || type;
  }

  $: totalPages = Math.ceil(total / limit);
</script>

<div class="ledger">
  <div class="header">
    <h3>Transaction History</h3>
    <button class="export-btn" onclick={exportCsv}>Export CSV</button>
  </div>

  {#if loading}
    <div class="loading">Loading transactions...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if entries.length === 0}
    <div class="empty">No transactions yet.</div>
  {:else}
    <table class="ledger-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Symbol</th>
          <th>Side</th>
          <th>Quantity</th>
          <th>Price</th>
          <th>Amount</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {#each entries as entry}
          <tr class="entry-{entry.entry_type}">
            <td>{formatDate(entry.created_at)}</td>
            <td><span class="type-badge {entry.entry_type}">{getEntryTypeLabel(entry.entry_type)}</span></td>
            <td class="symbol">{entry.symbol || '-'}</td>
            <td class="side" class:buy={entry.side === 'buy'} class:sell={entry.side === 'sell'}>
              {entry.side ? entry.side.toUpperCase() : '-'}
            </td>
            <td>{entry.quantity ? Number(entry.quantity).toFixed(4) : '-'}</td>
            <td>{entry.price ? formatCurrency(entry.price) : '-'}</td>
            <td class:positive={entry.amount > 0} class:negative={entry.amount < 0}>
              {formatCurrency(entry.amount)}
            </td>
            <td class="notes">{entry.notes || '-'}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if totalPages > 1}
      <div class="pagination">
        <button disabled={page === 0} onclick={() => { page--; loadLedger(); }}>
          Previous
        </button>
        <span>Page {page + 1} of {totalPages}</span>
        <button disabled={page >= totalPages - 1} onclick={() => { page++; loadLedger(); }}>
          Next
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .ledger {
    padding: 1rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .header h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  .export-btn {
    padding: 0.5rem 1rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
  }

  .export-btn:hover {
    background: #0056b3;
  }

  .loading, .error, .empty {
    text-align: center;
    padding: 2rem;
    color: #666;
  }

  .error {
    color: #dc3545;
  }

  .ledger-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    font-size: 0.875rem;
  }

  .ledger-table th,
  .ledger-table td {
    padding: 0.625rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid #eee;
  }

  .ledger-table th {
    background: #f8f9fa;
    font-size: 0.75rem;
    text-transform: uppercase;
    color: #666;
    font-weight: 600;
  }

  .symbol {
    font-weight: 600;
    color: #007bff;
  }

  .side.buy {
    color: #28a745;
    font-weight: 500;
  }

  .side.sell {
    color: #dc3545;
    font-weight: 500;
  }

  .positive {
    color: #28a745;
  }

  .negative {
    color: #dc3545;
  }

  .type-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .type-badge.fill {
    background: #e7f3ff;
    color: #007bff;
  }

  .type-badge.commission {
    background: #fff3cd;
    color: #856404;
  }

  .type-badge.adjustment {
    background: #f8f9fa;
    color: #666;
  }

  .notes {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #666;
    font-size: 0.75rem;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
  }

  .pagination button {
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
  }

  .pagination button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pagination span {
    font-size: 0.875rem;
    color: #666;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .ledger {
      padding: 0.5rem;
    }

    h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
    }

    .ledger-table {
      display: block;
      overflow-x: auto;
    }

    .ledger-table th,
    .ledger-table td {
      padding: 0.5rem;
      font-size: 0.75rem;
      white-space: nowrap;
    }

    .notes {
      max-width: 100px;
    }

    .pagination {
      gap: 0.5rem;
    }

    .pagination button {
      padding: 0.375rem 0.75rem;
      font-size: 0.875rem;
    }
  }
</style>
