import { writable, derived } from 'svelte/store';

export interface Strategy {
  id: number;
  user_id: number;
  name: string;
  cash_balance: number;
}

export interface User {
  id: number;
  auth0_id: string;
  email: string;
  display_name: string;
}

// Current user
export const currentUser = writable<User | null>(null);

// User's strategies
export const strategies = writable<Strategy[]>([]);

// Currently selected strategy
export const activeStrategyId = writable<number | null>(null);

// Derived store for active strategy
export const activeStrategy = derived(
  [strategies, activeStrategyId],
  ([$strategies, $activeStrategyId]) => {
    return $strategies.find(s => s.id === $activeStrategyId) || null;
  }
);

// Set active strategy by name (A, B, or C)
export function setActiveStrategyByName(name: string): void {
  strategies.subscribe(strats => {
    const strategy = strats.find(s => s.name === name);
    if (strategy) {
      activeStrategyId.set(strategy.id);
    }
  })();
}

// Initialize strategies and set default active
export function initStrategies(strats: Strategy[]): void {
  strategies.set(strats);
  if (strats.length > 0) {
    activeStrategyId.set(strats[0].id);
  }
}
