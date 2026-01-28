<script lang="ts">
  import { strategies, activeStrategyId, activeStrategy } from '$lib/stores';
  import { userApi } from '$lib/api';
  
  let editingId: number | null = null;
  let editName = '';
  let saving = false;
  let showAddForm = false;
  let newStrategyName = '';
  let addingStrategy = false;
  let addError = '';
  
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

  function startAdd() {
    showAddForm = true;
    newStrategyName = '';
    addError = '';
  }

  async function addStrategy() {
    if (!newStrategyName.trim()) return;

    addingStrategy = true;
    addError = '';
    try {
      const newStrategy = await userApi.createStrategy(newStrategyName.trim());
      strategies.update(strats => [...strats, newStrategy]);
      activeStrategyId.set(newStrategy.id);
      showAddForm = false;
      newStrategyName = '';
    } catch (e: any) {
      addError = e.message || 'Failed to create strategy';
    } finally {
      addingStrategy = false;
    }
  }

  function cancelAdd() {
    showAddForm = false;
    newStrategyName = '';
    addError = '';
  }

  function handleAddKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') addStrategy();
    else if (e.key === 'Escape') cancelAdd();
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
    
    {#if showAddForm}
      <div class="edit-container">
        <input
          type="text"
          bind:value={newStrategyName}
          onkeydown={handleAddKeydown}
          disabled={addingStrategy}
          placeholder="Strategy name"
        />
        <button class="save-btn" onclick={addStrategy} disabled={addingStrategy || !newStrategyName.trim()}>✓</button>
        <button class="cancel-btn" onclick={cancelAdd} disabled={addingStrategy}>✕</button>
      </div>
    {:else}
      <button class="add-btn" onclick={startAdd} title="Add new strategy">+</button>
    {/if}
  </div>
  {#if addError}
    <span class="error">{addError}</span>
  {/if}
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

  .add-btn {
    padding: 0.375rem 0.75rem;
    border: 1px dashed #28a745;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 700;
    font-size: 1rem;
    color: #28a745;
    transition: all 0.15s ease;
  }

  .add-btn:hover {
    background: #28a745;
    color: white;
  }

  .error {
    color: #dc3545;
    font-size: 0.75rem;
    margin-left: 0.5rem;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .strategy-toggle {
      gap: 0.25rem;
    }

    .strategy-btn {
      padding: 0.25rem 0.5rem;
      font-size: 0.8rem;
    }

    .edit-container input {
      width: 70px;
      font-size: 0.75rem;
    }

    .save-btn, .cancel-btn {
      padding: 0.2rem 0.4rem;
      font-size: 0.75rem;
    }
  }
</style>
