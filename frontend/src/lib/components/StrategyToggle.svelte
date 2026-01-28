<script lang="ts">
  import { strategies, activeStrategyId, activeStrategy } from '$lib/stores';
  import { userApi } from '$lib/api';
  
  let editingId: number | null = null;
  let editName = '';
  let saving = false;
  
  function selectStrategy(id: number) {
    activeStrategyId.set(id);
  }
  
  function startEdit(strategy: any, event: MouseEvent) {
    event.stopPropagation();
    editingId = strategy.id;
    editName = strategy.name;
  }
  
  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    
    saving = true;
    try {
      await userApi.renameStrategy(editingId, editName.trim());
      // Update local store
      strategies.update(strats => 
        strats.map(s => s.id === editingId ? { ...s, name: editName.trim() } : s)
      );
      editingId = null;
    } catch (e) {
      console.error('Failed to rename strategy:', e);
    } finally {
      saving = false;
    }
  }
  
  function cancelEdit() {
    editingId = null;
    editName = '';
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') saveEdit();
    else if (e.key === 'Escape') cancelEdit();
  }
</script>

<div class="strategy-toggle">
  <span class="label">Strategy:</span>
  <div class="buttons">
    {#each $strategies as strategy}
      {#if editingId === strategy.id}
        <div class="edit-container">
          <input
            type="text"
            bind:value={editName}
            onkeydown={handleKeydown}
            disabled={saving}
            autofocus
          />
          <button class="save-btn" onclick={saveEdit} disabled={saving}>✓</button>
          <button class="cancel-btn" onclick={cancelEdit} disabled={saving}>✕</button>
        </div>
      {:else}
        <button
          class="strategy-btn"
          class:active={$activeStrategyId === strategy.id}
          onclick={() => selectStrategy(strategy.id)}
          ondblclick={(e) => startEdit(strategy, e)}
          title="Double-click to rename"
        >
          {strategy.name}
        </button>
      {/if}
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
  
  .edit-container {
    display: flex;
    gap: 0.25rem;
  }
  
  .edit-container input {
    padding: 0.25rem 0.5rem;
    border: 1px solid #007bff;
    border-radius: 4px;
    width: 100px;
    font-size: 0.875rem;
  }
  
  .save-btn, .cancel-btn {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  .save-btn {
    background: #28a745;
    color: white;
  }
  
  .cancel-btn {
    background: #dc3545;
    color: white;
  }
  
  .save-btn:disabled, .cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
