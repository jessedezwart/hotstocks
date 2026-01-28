import { getAccessToken } from './auth';
import { apiConfig } from './config';

interface ApiOptions {
  method?: string;
  body?: Record<string, unknown> | unknown[];
  headers?: Record<string, string>;
}

export interface User {
  id: number;
  auth0_id: string;
  email: string;
  display_name: string;
}

export interface Strategy {
  id: number;
  user_id: number;
  name: string;
  cash_balance: number;
}

export interface Position {
  id: number;
  strategy_id: number;
  symbol: string;
  asset_type: string;
  quantity: number;
  average_cost: number;
  currentPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
  unrealizedPnlPercent?: number;
}

export interface Portfolio {
  strategyId: number;
  strategyName: string;
  cashBalance: number;
  totalMarketValue: number;
  netWorth: number;
  totalPnl: number;
  totalPnlPercent: number;
  unrealizedPnl: number;
  allocationByType?: Record<string, number>;
  allocationByCurrency?: Record<string, number>;
}

export interface TradeResult {
  success: boolean;
  fill: {
    symbol: string;
    side: string;
    quantity: number;
    price: number;
    amount: number;
    commission: number;
    newCashBalance: number;
  };
}

export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
}

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
}

export interface ChartDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LedgerEntry {
  id: number;
  strategy_id: number;
  entry_type: string;
  symbol?: string;
  side?: string;
  quantity?: number;
  price?: number;
  amount: number;
  commission?: number;
  notes?: string;
  created_at: string;
}

export interface LedgerResponse {
  entries: LedgerEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  displayName: string;
  strategyId: number;
  strategyName: string;
  netWorth: number;
  pnl: number;
  pnlPercent: number;
}

export interface NetWorthPoint {
  net_worth: number;
  recorded_at: string;
}

async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const token = await getAccessToken();
  
  const headers: Record<string, string> = {
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
}

// User API
export const userApi = {
  getMe: () => apiRequest<User>('/api/users/me'),
  createOrUpdateMe: (email: string, displayName: string) => apiRequest<User>('/api/users/me', {
    method: 'POST',
    body: { email, displayName },
  }),
  getMyStrategies: () => apiRequest<Strategy[]>('/api/users/me/strategies'),
  createStrategy: (name: string) => apiRequest<Strategy>('/api/users/me/strategies', {
    method: 'POST',
    body: { name },
  }),
  getAllUsers: () => apiRequest<User[]>('/api/users'),
  getUserStrategies: (userId: number) => apiRequest<Strategy[]>(`/api/users/${userId}/strategies`),
  updateProfile: (displayName: string) => apiRequest<User>('/api/users/me', {
    method: 'PATCH',
    body: { displayName },
  }),
  renameStrategy: (strategyId: number, name: string) => apiRequest<Strategy>(`/api/strategies/${strategyId}`, {
    method: 'PATCH',
    body: { name },
  }),
  deleteStrategy: (strategyId: number) => apiRequest<{ success: boolean }>(`/api/strategies/${strategyId}`, {
    method: 'DELETE',
  }),
};

// Trading API
export const tradingApi = {
  executeTrade: (trade: {
    strategyId: number;
    symbol: string;
    side: 'buy' | 'sell';
    quantity?: number;
    notionalAmount?: number;
    assetType: 'stock' | 'etf' | 'crypto';
    exchange?: string;
    currency?: string;
  }) => apiRequest<TradeResult>('/api/trade', {
    method: 'POST',
    body: trade,
  }),
  getPositions: (strategyId: number) => apiRequest<Position[]>(`/api/strategies/${strategyId}/positions`),
  getPortfolio: (strategyId: number) => apiRequest<Portfolio>(`/api/strategies/${strategyId}/portfolio`),
  getNetWorthHistory: (strategyId: number) => apiRequest<{ net_worth: number; recorded_at: string }[]>(`/api/strategies/${strategyId}/net-worth-history`),
};

// Market API
export const marketApi = {
  search: (query: string) => apiRequest<SearchResult[]>(`/api/market/search?q=${encodeURIComponent(query)}`),
  getQuote: (symbol: string) => apiRequest<Quote>(`/api/market/quote/${symbol}`),
  getChart: (symbol: string, interval = 'daily') => 
    apiRequest<ChartDataPoint[]>(`/api/market/chart/${symbol}?interval=${interval}`),
};

// Ledger API
export const ledgerApi = {
  getEntries: (strategyId: number, limit = 100, offset = 0) => 
    apiRequest<LedgerResponse>(`/api/strategies/${strategyId}/ledger?limit=${limit}&offset=${offset}`),
  exportCsv: async (strategyId: number) => {
    const token = await getAccessToken();
    const response = await fetch(`${apiConfig.baseUrl}/api/strategies/${strategyId}/ledger/export`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.blob();
  },
};

// Leaderboard API
export const leaderboardApi = {
  get: () => apiRequest<LeaderboardEntry[]>('/api/leaderboard'),
};

// WebSocket for real-time quotes
export function createQuoteStream(onQuote: (quote: Quote) => void): {
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
  close: () => void;
} {
  const ws = new WebSocket(`${apiConfig.baseUrl.replace('http', 'ws')}/api/market/stream`);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'quote') {
      onQuote(data.data);
    }
  };
  
  return {
    subscribe: (symbol: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'subscribe', symbol }));
      } else {
        ws.addEventListener('open', () => {
          ws.send(JSON.stringify({ type: 'subscribe', symbol }));
        }, { once: true });
      }
    },
    unsubscribe: (symbol: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', symbol }));
      }
    },
    close: () => ws.close(),
  };
}
