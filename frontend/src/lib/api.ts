import { getAccessToken } from './auth';
import { apiConfig } from './config';

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const token = await getAccessToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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
  getMe: () => apiRequest<any>('/api/users/me'),
  getMyStrategies: () => apiRequest<any[]>('/api/users/me/strategies'),
  getAllUsers: () => apiRequest<any[]>('/api/users'),
  getUserStrategies: (userId: number) => apiRequest<any[]>(`/api/users/${userId}/strategies`),
  updateProfile: (displayName: string) => apiRequest<any>('/api/users/me', {
    method: 'PATCH',
    body: { displayName },
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
  }) => apiRequest<any>('/api/trade', {
    method: 'POST',
    body: trade,
  }),
  getPositions: (strategyId: number) => apiRequest<any[]>(`/api/strategies/${strategyId}/positions`),
  getPortfolio: (strategyId: number) => apiRequest<any>(`/api/strategies/${strategyId}/portfolio`),
  getNetWorthHistory: (strategyId: number) => apiRequest<any[]>(`/api/strategies/${strategyId}/net-worth-history`),
};

// Market API
export const marketApi = {
  search: (query: string) => apiRequest<any[]>(`/api/market/search?q=${encodeURIComponent(query)}`),
  getQuote: (symbol: string) => apiRequest<any>(`/api/market/quote/${symbol}`),
  getChart: (symbol: string, interval = 'daily') => 
    apiRequest<any[]>(`/api/market/chart/${symbol}?interval=${interval}`),
};

// Ledger API
export const ledgerApi = {
  getEntries: (strategyId: number, limit = 100, offset = 0) => 
    apiRequest<any>(`/api/strategies/${strategyId}/ledger?limit=${limit}&offset=${offset}`),
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
  get: () => apiRequest<any[]>('/api/leaderboard'),
};

// WebSocket for real-time quotes
export function createQuoteStream(onQuote: (quote: any) => void): {
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
