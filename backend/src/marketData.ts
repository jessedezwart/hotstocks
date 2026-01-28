import axios from 'axios';
import { config } from './config.js';

interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

interface ChartData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Cache for quotes (expires after 15 seconds)
const quoteCache = new Map<string, { quote: Quote; timestamp: number }>();
const CACHE_TTL = 15000;

export async function getQuote(symbol: string): Promise<Quote | null> {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.quote;
  }

  try {
    // Check if it's a crypto symbol
    if (symbol.includes('-') || ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP'].includes(symbol.toUpperCase())) {
      return await getCryptoQuote(symbol);
    }

    const response = await axios.get(config.alphaVantage.baseUrl, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: symbol.toUpperCase(),
        apikey: config.alphaVantage.apiKey,
      },
    });

    const data = response.data['Global Quote'];
    if (!data || !data['05. price']) {
      return null;
    }

    const quote: Quote = {
      symbol: data['01. symbol'],
      price: parseFloat(data['05. price']),
      change: parseFloat(data['09. change']),
      changePercent: parseFloat(data['10. change percent']?.replace('%', '') || '0'),
      volume: parseInt(data['06. volume']),
      timestamp: data['07. latest trading day'],
    };

    quoteCache.set(symbol, { quote, timestamp: Date.now() });
    return quote;
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    return null;
  }
}

async function getCryptoQuote(symbol: string): Promise<Quote | null> {
  try {
    const cryptoSymbol = symbol.replace('-USD', '').replace('USD', '');
    
    const response = await axios.get(config.alphaVantage.baseUrl, {
      params: {
        function: 'CURRENCY_EXCHANGE_RATE',
        from_currency: cryptoSymbol,
        to_currency: 'USD',
        apikey: config.alphaVantage.apiKey,
      },
    });

    const data = response.data['Realtime Currency Exchange Rate'];
    if (!data) {
      return null;
    }

    const quote: Quote = {
      symbol: `${cryptoSymbol}-USD`,
      price: parseFloat(data['5. Exchange Rate']),
      change: 0,
      changePercent: 0,
      volume: 0,
      timestamp: data['6. Last Refreshed'],
    };

    quoteCache.set(symbol, { quote, timestamp: Date.now() });
    return quote;
  } catch (error) {
    console.error(`Error fetching crypto quote for ${symbol}:`, error);
    return null;
  }
}

export async function searchSymbols(query: string): Promise<Array<{
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  currency: string;
}>> {
  try {
    const response = await axios.get(config.alphaVantage.baseUrl, {
      params: {
        function: 'SYMBOL_SEARCH',
        keywords: query,
        apikey: config.alphaVantage.apiKey,
      },
    });

    const matches = response.data.bestMatches || [];
    return matches.map((match: any) => ({
      symbol: match['1. symbol'],
      name: match['2. name'],
      type: match['3. type'],
      exchange: match['4. region'],
      currency: match['8. currency'],
    }));
  } catch (error) {
    console.error(`Error searching symbols for ${query}:`, error);
    return [];
  }
}

export async function getChartData(
  symbol: string,
  interval: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<ChartData[]> {
  try {
    const functionName = {
      daily: 'TIME_SERIES_DAILY',
      weekly: 'TIME_SERIES_WEEKLY',
      monthly: 'TIME_SERIES_MONTHLY',
    }[interval];

    const response = await axios.get(config.alphaVantage.baseUrl, {
      params: {
        function: functionName,
        symbol: symbol.toUpperCase(),
        apikey: config.alphaVantage.apiKey,
      },
    });

    const timeSeriesKey = Object.keys(response.data).find((key) =>
      key.includes('Time Series')
    );
    
    if (!timeSeriesKey) {
      return [];
    }

    const timeSeries = response.data[timeSeriesKey];
    const chartData: ChartData[] = [];

    for (const [timestamp, values] of Object.entries(timeSeries)) {
      const v = values as any;
      chartData.push({
        timestamp,
        open: parseFloat(v['1. open']),
        high: parseFloat(v['2. high']),
        low: parseFloat(v['3. low']),
        close: parseFloat(v['4. close']),
        volume: parseInt(v['5. volume']),
      });
    }

    return chartData.reverse();
  } catch (error) {
    console.error(`Error fetching chart data for ${symbol}:`, error);
    return [];
  }
}

// WebSocket subscribers for real-time updates
const priceSubscribers = new Map<string, Set<(quote: Quote) => void>>();

export function subscribeToPriceUpdates(
  symbol: string,
  callback: (quote: Quote) => void
): () => void {
  if (!priceSubscribers.has(symbol)) {
    priceSubscribers.set(symbol, new Set());
    startPricePolling(symbol);
  }
  
  priceSubscribers.get(symbol)!.add(callback);
  
  return () => {
    const subscribers = priceSubscribers.get(symbol);
    if (subscribers) {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        priceSubscribers.delete(symbol);
      }
    }
  };
}

async function startPricePolling(symbol: string): Promise<void> {
  const poll = async () => {
    const subscribers = priceSubscribers.get(symbol);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const quote = await getQuote(symbol);
    if (quote) {
      subscribers.forEach((callback) => callback(quote));
    }

    setTimeout(poll, 15000); // Poll every 15 seconds (Alpha Vantage rate limit)
  };

  poll();
}
