<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { leaderboardApi } from '$lib/api';

  let leaderboard: any[] = [];
  let loading = true;
  let error = '';

  onMount(async () => {
    await loadLeaderboard();
  });

  async function loadLeaderboard() {
    loading = true;
    error = '';
    try {
      leaderboard = await leaderboardApi.get();
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function viewUser(entry: any) {
    goto(`/friends?userId=${entry.userId}&strategyId=${entry.strategyId}`);
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  function formatPercent(value: number): string {
    const num = Number(value);
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  }

  function getRankClass(rank: number): string {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return '';
  }
</script>

<div class="leaderboard">
  <h2>🏆 Leaderboard</h2>
  
  {#if loading}
    <div class="loading">Loading leaderboard...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if leaderboard.length === 0}
    <div class="empty">No strategies yet.</div>
  {:else}
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player</th>
          <th>Strategy</th>
          <th>Net Worth</th>
          <th>P&L</th>
          <th>Return</th>
        </tr>
      </thead>
      <tbody>
        {#each leaderboard as entry}
          <tr class="{getRankClass(entry.rank)} clickable" onclick={() => viewUser(entry)}>
            <td class="rank">
              {#if entry.rank === 1}🥇
              {:else if entry.rank === 2}🥈
              {:else if entry.rank === 3}🥉
              {:else}#{entry.rank}
              {/if}
            </td>
            <td class="player">{entry.displayName}</td>
            <td class="strategy">Strategy {entry.strategyName}</td>
            <td class="net-worth">{formatCurrency(entry.netWorth)}</td>
            <td class="pnl" class:positive={entry.pnl >= 0} class:negative={entry.pnl < 0}>
              {formatCurrency(entry.pnl)}
            </td>
            <td class="return" class:positive={entry.pnlPercent >= 0} class:negative={entry.pnlPercent < 0}>
              {formatPercent(entry.pnlPercent)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .leaderboard {
    padding: 1rem;
  }

  h2 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .loading, .error, .empty {
    text-align: center;
    padding: 2rem;
    color: #666;
  }

  .error {
    color: #dc3545;
  }

  .leaderboard-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .leaderboard-table th,
  .leaderboard-table td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid #eee;
  }

  .leaderboard-table th {
    background: #f8f9fa;
    font-size: 0.75rem;
    text-transform: uppercase;
    color: #666;
    font-weight: 600;
  }

  .rank {
    font-size: 1.25rem;
    text-align: center;
  }

  .player {
    font-weight: 600;
  }

  .strategy {
    color: #666;
  }

  .net-worth {
    font-weight: 600;
    font-size: 1.1rem;
  }

  .positive {
    color: #28a745;
  }

  .negative {
    color: #dc3545;
  }

  tr.gold {
    background: linear-gradient(90deg, rgba(255, 215, 0, 0.1) 0%, transparent 100%);
  }

  tr.silver {
    background: linear-gradient(90deg, rgba(192, 192, 192, 0.1) 0%, transparent 100%);
  }

  tr.bronze {
    background: linear-gradient(90deg, rgba(205, 127, 50, 0.1) 0%, transparent 100%);
  }

  tr.clickable {
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  tr.clickable:hover {
    background-color: rgba(0, 123, 255, 0.05);
  }

  tr.clickable.gold:hover {
    background: linear-gradient(90deg, rgba(255, 215, 0, 0.2) 0%, rgba(0, 123, 255, 0.05) 100%);
  }

  tr.clickable.silver:hover {
    background: linear-gradient(90deg, rgba(192, 192, 192, 0.2) 0%, rgba(0, 123, 255, 0.05) 100%);
  }

  tr.clickable.bronze:hover {
    background: linear-gradient(90deg, rgba(205, 127, 50, 0.2) 0%, rgba(0, 123, 255, 0.05) 100%);
  }
</style>
