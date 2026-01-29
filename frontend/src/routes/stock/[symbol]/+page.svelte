<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { marketApi, type SearchResult } from '$lib/api';
  import SymbolSearch from '$lib/components/SymbolSearch.svelte';
  import QuoteView from '$lib/components/QuoteView.svelte';
  import TradeTicket from '$lib/components/TradeTicket.svelte';

  let meta: SearchResult | null = null;
  let loadingMeta = false;
  let metaError = '';
  let lastSymbol = '';

  $: symbol = $page.params.symbol ?? '';
  $: if (symbol && symbol !== lastSymbol) {
    lastSymbol = symbol;
    loadMeta(symbol);
  }

  async function loadMeta(value: string) {
    loadingMeta = true;
    metaError = '';
    try {
      const results = await marketApi.search(value);
      const match = results.find(
        (result) => result.symbol?.toUpperCase() === value.toUpperCase()
      );
      meta = match || {
        symbol: value.toUpperCase(),
        name: value.toUpperCase(),
        type: 'Equity',
        region: '',
        currency: 'USD',
        exchange: 'Unknown',
      };
    } catch (e: any) {
      metaError = e?.message || 'Unable to load symbol details';
      meta = {
        symbol: value.toUpperCase(),
        name: value.toUpperCase(),
        type: 'Equity',
        region: '',
        currency: 'USD',
        exchange: 'Unknown',
      };
    } finally {
      loadingMeta = false;
    }
  }

  function handleTrade(event: CustomEvent) {
    console.log('Trade executed:', event.detail);
  }

  function backToHome() {
    goto('/');
  }

  function handleSymbolSelect(event: CustomEvent) {
    if (!event.detail?.symbol) return;
    goto(`/stock/${encodeURIComponent(event.detail.symbol)}`);
  }

  $: assetType =
    meta?.type === 'ETF'
      ? 'etf'
      : meta?.type === 'Crypto'
        ? 'crypto'
        : 'stock';
  $: exchange = meta?.exchange || '';
  $: currency = meta?.currency || 'USD';
</script>

<div class="stock-page">
  <div class="header">
    <button class="back-btn" onclick={backToHome}>← Back</button>
    <div class="title">
      <h2>{meta?.symbol || symbol.toUpperCase()}</h2>
      <p>{meta?.name || 'Loading symbol details...'}</p>
    </div>
    <div class="search-box">
      <SymbolSearch initialQuery={symbol} on:select={handleSymbolSelect} />
    </div>
  </div>

  {#if metaError}
    <div class="meta-error">{metaError}</div>
  {/if}

  <div class="trade-layout">
    <div class="quote-section">
      <QuoteView symbol={symbol} showChart={true} />
    </div>
    <div class="ticket-section">
      <TradeTicket
        symbol={symbol}
        assetType={assetType}
        exchange={exchange}
        currency={currency}
        on:trade={handleTrade}
      />
    </div>
  </div>
</div>

<style>
  .stock-page {
    max-width: 1200px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .back-btn {
    border: 1px solid #ddd;
    background: white;
    border-radius: 999px;
    padding: 0.4rem 0.9rem;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .back-btn:hover {
    border-color: #007bff;
    color: #007bff;
  }

  h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .title p {
    margin: 0.25rem 0 0 0;
    color: #666;
    font-size: 0.95rem;
  }

  .search-box {
    margin-left: auto;
    min-width: 260px;
    width: 340px;
  }

  @media (max-width: 900px) {
    .search-box {
      margin-left: 0;
      width: 100%;
    }
  }

  .meta-error {
    background: #f8d7da;
    color: #721c24;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
  }

  .trade-layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 2rem;
    align-items: start;
  }

  @media (max-width: 900px) {
    .trade-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
