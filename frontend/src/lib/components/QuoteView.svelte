<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { marketApi, createQuoteStream } from '$lib/api';

  export let symbol: string;
  export let showChart = true;

  let quote: any = null;
  let chartData: any[] = [];
  let loading = true;
  let error = '';
  let quoteStream: ReturnType<typeof createQuoteStream> | null = null;

  onMount(async () => {
    await loadData();
    setupStream();
  });

  onDestroy(() => {
    if (quoteStream) {
      quoteStream.unsubscribe(symbol);
      quoteStream.close();
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
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function setupStream() {
    quoteStream = createQuoteStream((newQuote) => {
      if (newQuote.symbol === symbol) {
        quote = newQuote;
      }
    });
    quoteStream.subscribe(symbol);
  }

  $: priceClass = quote?.change >= 0 ? 'positive' : 'negative';
</script>

<div class="quote-view">
  {#if loading}
    <div class="loading">Loading quote...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if quote}
    <div class="quote-header">
      <h2 class="symbol">{quote.symbol}</h2>
      <div class="price-container">
        <span class="price">${Number(quote.price).toFixed(2)}</span>
        <span class="change {priceClass}">
          {quote.change >= 0 ? '+' : ''}{Number(quote.change).toFixed(2)}
          ({Number(quote.changePercent).toFixed(2)}%)
        </span>
      </div>
    </div>

    {#if showChart && chartData.length > 0}
      <div class="chart-container">
        <canvas id="price-chart"></canvas>
      </div>
    {/if}

    <div class="quote-details">
      <div class="detail">
        <span class="label">Volume</span>
        <span class="value">{quote.volume?.toLocaleString() || 'N/A'}</span>
      </div>
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

  .symbol {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }

  .price-container {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
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

  .chart-container {
    height: 300px;
    margin: 1rem 0;
    background: #f8f9fa;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
  }

  .quote-details {
    display: flex;
    gap: 2rem;
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
</style>
