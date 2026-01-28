<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { marketApi } from '$lib/api';

  const dispatch = createEventDispatcher();

  let query = '';
  let results: any[] = [];
  let loading = false;
  let showResults = false;
  let debounceTimer: ReturnType<typeof setTimeout>;

  function handleInput() {
    clearTimeout(debounceTimer);
    if (query.length < 1) {
      results = [];
      showResults = false;
      return;
    }
    
    debounceTimer = setTimeout(async () => {
      loading = true;
      try {
        results = await marketApi.search(query);
        showResults = true;
      } catch (e) {
        console.error('Search error:', e);
        results = [];
      } finally {
        loading = false;
      }
    }, 300);
  }

  function selectSymbol(result: any) {
    query = result.symbol;
    showResults = false;
    dispatch('select', result);
  }

  function handleBlur() {
    setTimeout(() => {
      showResults = false;
    }, 200);
  }
</script>

<div class="symbol-search">
  <input
    type="text"
    placeholder="Search stocks, ETFs, crypto..."
    bind:value={query}
    oninput={handleInput}
    onfocus={() => results.length > 0 && (showResults = true)}
    onblur={handleBlur}
  />
  
  {#if loading}
    <div class="loading-indicator">Searching...</div>
  {/if}

  {#if showResults && results.length > 0}
    <ul class="results">
      {#each results as result}
        <li>
          <button onclick={() => selectSymbol(result)}>
            <span class="symbol">{result.symbol}</span>
            <span class="name">{result.name}</span>
            <span class="meta">{result.type} • {result.exchange}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .symbol-search {
    position: relative;
    width: 100%;
    max-width: 400px;
  }

  input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  input:focus {
    border-color: #007bff;
  }

  .loading-indicator {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.75rem;
    color: #666;
  }

  .results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    margin-top: 4px;
    max-height: 300px;
    overflow-y: auto;
    list-style: none;
    padding: 0;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .results li button {
    width: 100%;
    padding: 0.75rem 1rem;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    transition: background 0.15s ease;
  }

  .results li button:hover {
    background: #f8f9fa;
  }

  .results li:not(:last-child) button {
    border-bottom: 1px solid #eee;
  }

  .symbol {
    font-weight: 600;
    color: #007bff;
  }

  .name {
    font-size: 0.875rem;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    font-size: 0.75rem;
    color: #666;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    input {
      font-size: 16px; /* Prevents zoom on iOS */
      padding: 0.625rem 0.875rem;
    }

    .results {
      max-height: 250px;
    }

    .results li button {
      padding: 0.625rem 0.875rem;
    }

    .name {
      font-size: 0.8rem;
    }
  }
</style>
