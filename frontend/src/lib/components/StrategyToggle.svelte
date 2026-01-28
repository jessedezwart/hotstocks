<script lang="ts">
  import { strategies, activeStrategyId, activeStrategy } from '$lib/stores';
  
  function selectStrategy(id: number) {
    activeStrategyId.set(id);
  }
</script>

<div class="strategy-toggle">
  <span class="label">Strategy:</span>
  <div class="buttons">
    {#each $strategies as strategy}
      <button
        class="strategy-btn"
        class:active={$activeStrategyId === strategy.id}
        onclick={() => selectStrategy(strategy.id)}
      >
        {strategy.name}
      </button>
    {/each}
  </div>
</div>

<style>
  .strategy-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .label {
    font-size: 0.875rem;
    color: #666;
  }
  
  .buttons {
    display: flex;
    gap: 0.25rem;
  }
  
  .strategy-btn {
    padding: 0.375rem 0.75rem;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.15s ease;
  }
  
  .strategy-btn:hover {
    border-color: #007bff;
  }
  
  .strategy-btn.active {
    background: #007bff;
    color: white;
    border-color: #007bff;
  }
</style>
