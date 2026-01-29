<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { activeStrategy } from '$lib/stores';
  import { tradingApi, marketApi } from '$lib/api';

  const dispatch = createEventDispatcher();

  const COMMISSION = 4.95;

  export let symbol = '';
  export let assetType: 'stock' | 'etf' | 'crypto' = 'stock';
  export let exchange = '';
  export let currency = 'USD';

  let side: 'buy' | 'sell' = 'buy';
  let inputMode: 'shares' | 'dollars' = 'shares';
  let quantity = '';
  let notionalAmount = '';
  let quote: any = null;
  let loading = false;
  let submitting = false;
  let error = '';
  let success = '';

  $: if (symbol) {
    loadQuote();
  }

  async function loadQuote() {
    loading = true;
    try {
      quote = await marketApi.getQuote(symbol);
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  $: estimatedTotal = (() => {
    if (!quote) return 0;
    if (inputMode === 'shares' && quantity) {
      return parseFloat(quantity) * quote.price + COMMISSION;
    }
    if (inputMode === 'dollars' && notionalAmount) {
      return parseFloat(notionalAmount) + COMMISSION;
    }
    return 0;
  })();

  $: estimatedShares = (() => {
    if (!quote) return 0;
    if (inputMode === 'shares' && quantity) {
      return parseFloat(quantity);
    }
    if (inputMode === 'dollars' && notionalAmount) {
      return parseFloat(notionalAmount) / quote.price;
    }
    return 0;
  })();

  $: availableCash = (() => {
    if (!$activeStrategy) return 0;
    const cash = Number($activeStrategy.cash_balance);
    return Number.isFinite(cash) ? cash : 0;
  })();

  $: maxBuyNotional = Math.max(availableCash - COMMISSION, 0);

  $: maxBuyShares = (() => {
    if (!quote || !Number.isFinite(quote.price) || quote.price <= 0) return 0;
    return maxBuyNotional / quote.price;
  })();

  function applyMaxBuy() {
    if (!quote || maxBuyNotional <= 0) return;
    if (inputMode === 'shares') {
      quantity = maxBuyShares ? maxBuyShares.toFixed(6) : '';
      notionalAmount = '';
    } else {
      notionalAmount = maxBuyNotional ? maxBuyNotional.toFixed(2) : '';
      quantity = '';
    }
  }

  async function submitOrder() {
    if (!$activeStrategy) {
      error = 'Please select a strategy';
      return;
    }

    submitting = true;
    error = '';
    success = '';

    try {
      const trade: any = {
        strategyId: $activeStrategy.id,
        symbol,
        side,
        assetType,
        exchange,
        currency,
      };

      if (inputMode === 'shares') {
        trade.quantity = parseFloat(quantity);
      } else {
        trade.notionalAmount = parseFloat(notionalAmount);
      }

      const result = await tradingApi.executeTrade(trade);
      success = `Order filled: ${side.toUpperCase()} ${Number(result.fill.quantity).toFixed(4)} ${symbol} @ $${Number(result.fill.price).toFixed(2)}`;
      dispatch('trade', result);
      
      // Reset form
      quantity = '';
      notionalAmount = '';
    } catch (e: any) {
      error = e.message;
    } finally {
      submitting = false;
    }
  }
</script>

<div class="trade-ticket">
  <h3>Trade {symbol}</h3>
  
  {#if loading}
    <div class="loading">Loading quote...</div>
  {:else if quote}
    <div class="current-price">
      <span class="label">Current Price</span>
      <span class="price">${Number(quote.price).toFixed(2)}</span>
    </div>

    <div class="side-toggle">
      <button 
        class="side-btn buy" 
        class:active={side === 'buy'}
        onclick={() => side = 'buy'}
      >
        Buy
      </button>
      <button 
        class="side-btn sell" 
        class:active={side === 'sell'}
        onclick={() => side = 'sell'}
      >
        Sell
      </button>
    </div>

    <div class="input-mode-toggle">
      <button 
        class:active={inputMode === 'shares'}
        onclick={() => inputMode = 'shares'}
      >
        Shares
      </button>
      <button 
        class:active={inputMode === 'dollars'}
        onclick={() => inputMode = 'dollars'}
      >
        Dollars
      </button>
    </div>

    {#if inputMode === 'shares'}
      <div class="input-group">
        <label for="quantity">Quantity</label>
        <input 
          type="number" 
          id="quantity"
          bind:value={quantity}
          placeholder="0"
          min="0"
          step="any"
        />
      </div>
    {:else}
      <div class="input-group">
        <label for="notional">Amount ($)</label>
        <input 
          type="number" 
          id="notional"
          bind:value={notionalAmount}
          placeholder="0.00"
          min="0"
          step="0.01"
        />
      </div>
    {/if}

    {#if side === 'buy'}
      <div class="max-buy">
        <button
          class="max-btn"
          type="button"
          onclick={applyMaxBuy}
          disabled={!quote || maxBuyNotional <= 0}
        >
          Max
        </button>
        <span class="max-text">Available to spend: ${Number(maxBuyNotional).toFixed(2)}</span>
      </div>
    {/if}

    <div class="order-summary">
      {#if side === 'buy'}
        <div class="summary-row">
          <span>Max to Spend</span>
          <span>${Number(maxBuyNotional).toFixed(2)}</span>
        </div>
      {/if}
      <div class="summary-row">
        <span>Estimated Shares</span>
        <span>{Number(estimatedShares).toFixed(4)}</span>
      </div>
      <div class="summary-row">
        <span>Commission</span>
        <span>${COMMISSION.toFixed(2)}</span>
      </div>
      <div class="summary-row total">
        <span>Estimated Total</span>
        <span>${Number(estimatedTotal).toFixed(2)}</span>
      </div>
    </div>

    {#if error}
      <div class="error">{error}</div>
    {/if}

    {#if success}
      <div class="success">{success}</div>
    {/if}

    <button 
      class="submit-btn {side}"
      onclick={submitOrder}
      disabled={submitting || (!quantity && !notionalAmount)}
    >
      {submitting ? 'Processing...' : `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol}`}
    </button>
  {/if}
</div>

<style>
  .trade-ticket {
    padding: 1.5rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
  }

  .loading {
    text-align: center;
    color: #666;
    padding: 2rem;
  }

  .current-price {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .current-price .label {
    color: #666;
    font-size: 0.875rem;
  }

  .current-price .price {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .side-toggle, .input-mode-toggle {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .side-btn, .input-mode-toggle button {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.15s ease;
  }

  .side-btn.buy.active {
    background: #28a745;
    color: white;
    border-color: #28a745;
  }

  .side-btn.sell.active {
    background: #dc3545;
    color: white;
    border-color: #dc3545;
  }

  .input-mode-toggle button.active {
    background: #007bff;
    color: white;
    border-color: #007bff;
  }

  .input-group {
    margin-bottom: 1rem;
  }

  .input-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    color: #666;
  }

  .input-group input {
    width: 100%;
    padding: 0.75rem;
    font-size: 1.25rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    outline: none;
  }

  .input-group input:focus {
    border-color: #007bff;
  }

  .max-buy {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: -0.5rem 0 1rem;
    font-size: 0.875rem;
    color: #555;
  }

  .max-btn {
    border: 1px solid #ddd;
    background: white;
    border-radius: 999px;
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .max-btn:hover:not(:disabled) {
    border-color: #28a745;
    color: #28a745;
  }

  .max-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .max-text {
    color: #666;
  }

  .order-summary {
    background: #f8f9fa;
    border-radius: 4px;
    padding: 0.75rem;
    margin-bottom: 1rem;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 0.375rem 0;
    font-size: 0.875rem;
  }

  .summary-row.total {
    border-top: 1px solid #ddd;
    margin-top: 0.375rem;
    padding-top: 0.75rem;
    font-weight: 600;
  }

  .error {
    background: #f8d7da;
    color: #721c24;
    padding: 0.75rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .success {
    background: #d4edda;
    color: #155724;
    padding: 0.75rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .submit-btn {
    width: 100%;
    padding: 1rem;
    font-size: 1rem;
    font-weight: 600;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .submit-btn.buy {
    background: #28a745;
  }

  .submit-btn.sell {
    background: #dc3545;
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .trade-ticket {
      padding: 1rem;
    }

    .input-mode-toggle {
      flex-direction: column;
    }

    .input-mode-toggle button {
      width: 100%;
    }

    .input-group input {
      font-size: 1rem;
      padding: 0.625rem;
    }

    .submit-btn {
      padding: 0.875rem;
    }
  }
</style>
