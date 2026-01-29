<script lang="ts">
  import { page } from '$app/stores';
  import MarketOverview from '$lib/components/MarketOverview.svelte';
  import SymbolSearch from '$lib/components/SymbolSearch.svelte';
  import QuoteView from '$lib/components/QuoteView.svelte';
  import TradeTicket from '$lib/components/TradeTicket.svelte';

  let selectedSymbol: any = null;
  let lastSymbolParam = '';

  $: symbolParam = $page.url.searchParams.get('symbol') ?? '';
  $: if (symbolParam && symbolParam !== lastSymbolParam) {
    lastSymbolParam = symbolParam;
    selectedSymbol = null;
  }

  function handleSymbolSelect(event: CustomEvent) {
    selectedSymbol = event.detail;
  }

  function handleTrade(event: CustomEvent) {
    // Optionally refresh data after trade
    console.log('Trade executed:', event.detail);
  }
</script>

<div class="trade-page">
  <h2>Search & Trade</h2>

  <MarketOverview />
  
  <div class="search-section">
    <SymbolSearch
      initialQuery={symbolParam}
      autoSelectExact={true}
      on:select={handleSymbolSelect}
    />
  </div>

  {#if selectedSymbol}
    <div class="trade-layout">
      <div class="quote-section">
        <QuoteView 
          symbol={selectedSymbol.symbol} 
          showChart={true} 
        />
      </div>
      <div class="ticket-section">
        <TradeTicket 
          symbol={selectedSymbol.symbol}
          assetType={selectedSymbol.type === 'ETF' ? 'etf' : selectedSymbol.type === 'Crypto' ? 'crypto' : 'stock'}
          exchange={selectedSymbol.exchange}
          currency={selectedSymbol.currency}
          on:trade={handleTrade}
        />
      </div>
    </div>
  {:else}
    <div class="placeholder">
      <p>Search for a stock, ETF, or crypto to start trading</p>
    </div>
  {/if}
</div>

<style>
  .trade-page {
    max-width: 1200px;
    margin: 0 auto;
  }

  h2 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .search-section {
    margin-bottom: 2rem;
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

  .placeholder {
    text-align: center;
    padding: 4rem 2rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    color: #666;
  }

  .placeholder p {
    margin: 0;
    font-size: 1.1rem;
  }
</style>
