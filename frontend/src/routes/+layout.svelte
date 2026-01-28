<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { initAuth0, isAuthenticated, isLoading, user, login, logout } from '$lib/auth';
  import { userApi } from '$lib/api';
  import { currentUser, initStrategies } from '$lib/stores';
  import StrategyToggle from '$lib/components/StrategyToggle.svelte';
  
  let { children } = $props();

  onMount(async () => {
    await initAuth0();
  });

  // Load user data when authenticated
  $effect(() => {
    if ($isAuthenticated && !$isLoading) {
      loadUserData();
    }
  });

  async function loadUserData() {
    try {
      const [userData, strategies] = await Promise.all([
        userApi.getMe(),
        userApi.getMyStrategies(),
      ]);
      currentUser.set(userData);
      initStrategies(strategies);
    } catch (e) {
      console.error('Failed to load user data:', e);
    }
  }

  const navItems = [
    { href: '/', label: 'Trade', icon: '📈' },
    { href: '/portfolio', label: 'Portfolio', icon: '💼' },
    { href: '/history', label: 'History', icon: '📜' },
    { href: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
    { href: '/friends', label: 'Friends', icon: '👥' },
  ];
</script>

<svelte:head>
  <title>Hot Stocks - Virtual Trading Game</title>
</svelte:head>

<div class="app">
  {#if $isLoading}
    <div class="loading-screen">
      <div class="spinner"></div>
      <p>Loading Hot Stocks...</p>
    </div>
  {:else if !$isAuthenticated}
    <div class="login-screen">
      <div class="login-card">
        <h1>🔥 Hot Stocks</h1>
        <p>Virtual trading game for friends</p>
        <button class="login-btn" onclick={login}>
          Log In to Play
        </button>
      </div>
    </div>
  {:else}
    <header class="header">
      <div class="header-left">
        <h1 class="logo">🔥 Hot Stocks</h1>
        <nav class="nav">
          {#each navItems as item}
            <a 
              href={item.href} 
              class="nav-link"
              class:active={$page.url.pathname === item.href}
            >
              <span class="icon">{item.icon}</span>
              <span class="label">{item.label}</span>
            </a>
          {/each}
        </nav>
      </div>
      <div class="header-right">
        <StrategyToggle />
        <div class="user-menu">
          <span class="user-name">{$user?.name || $user?.email}</span>
          <button class="logout-btn" onclick={logout}>Logout</button>
        </div>
      </div>
    </header>

    <main class="main">
      {@render children()}
    </main>
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    background: #f5f7fa;
    color: #333;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .app {
    min-height: 100vh;
  }

  .loading-screen, .login-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-screen p {
    color: white;
    margin-top: 1rem;
  }

  .login-card {
    background: white;
    padding: 3rem;
    border-radius: 16px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .login-card h1 {
    font-size: 2.5rem;
    margin: 0 0 0.5rem 0;
  }

  .login-card p {
    color: #666;
    margin: 0 0 2rem 0;
  }

  .login-btn {
    padding: 1rem 2rem;
    font-size: 1.1rem;
    font-weight: 600;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .login-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .header {
    background: white;
    padding: 0 1rem;
    min-height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    z-index: 100;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .header-left, .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-left {
    flex-wrap: wrap;
  }

  .logo {
    font-size: 1.25rem;
    margin: 0;
    white-space: nowrap;
  }

  .nav {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    color: #666;
    text-decoration: none;
    border-radius: 6px;
    transition: all 0.15s ease;
  }

  .nav-link:hover {
    background: #f5f7fa;
    color: #333;
  }

  .nav-link.active {
    background: #e7f3ff;
    color: #007bff;
  }

  .nav-link .icon {
    font-size: 1.1rem;
  }

  .nav-link .label {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .user-menu {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .user-name {
    font-size: 0.875rem;
    color: #666;
  }

  .logout-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    background: none;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    color: #666;
  }

  .logout-btn:hover {
    border-color: #dc3545;
    color: #dc3545;
  }

  .main {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem;
  }

  /* Mobile Responsive Styles */
  @media (max-width: 768px) {
    .header {
      padding: 0.5rem;
      min-height: auto;
    }

    .header-left {
      width: 100%;
      justify-content: space-between;
    }

    .header-right {
      width: 100%;
      justify-content: space-between;
      padding: 0.5rem 0;
    }

    .logo {
      font-size: 1.1rem;
    }

    .nav {
      gap: 0;
    }

    .nav-link {
      padding: 0.4rem 0.5rem;
    }

    .nav-link .label {
      display: none;
    }

    .nav-link .icon {
      font-size: 1.25rem;
    }

    .user-name {
      display: none;
    }

    .main {
      padding: 0.75rem;
    }

    .login-card {
      margin: 1rem;
      padding: 2rem 1.5rem;
    }

    .login-card h1 {
      font-size: 2rem;
    }
  }

  @media (max-width: 480px) {
    .header-left, .header-right {
      gap: 0.5rem;
    }

    .nav-link {
      padding: 0.35rem 0.4rem;
    }

    .nav-link .icon {
      font-size: 1.1rem;
    }

    .logout-btn {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }
  }
</style>
