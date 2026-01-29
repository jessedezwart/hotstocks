<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import MarketOverview from '$lib/components/MarketOverview.svelte';
  import SymbolSearch from '$lib/components/SymbolSearch.svelte';

  $: symbolParam = $page.url.searchParams.get('symbol') ?? '';
  $: if (browser && symbolParam) {
    goto(`/stock/${encodeURIComponent(symbolParam)}`, { replaceState: true });
  }

  function handleSymbolSelect(event: CustomEvent) {
    if (!event.detail?.symbol) return;
    goto(`/stock/${encodeURIComponent(event.detail.symbol)}`);
  }
</script>

<div class="trade-page">
  <h2>Search & Trade</h2>

  <div class="search-section">
    <SymbolSearch
      initialQuery={symbolParam}
      autoSelectExact={true}
      on:select={handleSymbolSelect}
    />
  </div>

  <MarketOverview />
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

</style>
