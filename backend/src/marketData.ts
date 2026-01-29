import YahooFinance from 'yahoo-finance2';
import { cacheGetJson, cacheSetJson } from './cache.js';

const yahooFinance = new YahooFinance();

interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  marketState: string | null;
  regularMarketTime: string | null;
}

interface ChartData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ProfileSummary {
  description: string | null;
  sector: string | null;
  industry: string | null;
  website: string | null;
  fullTimeEmployees: number | null;
  longName: string | null;
  shortName: string | null;
}

interface MostActiveQuote {
  symbol: string;
  shortName: string | null;
  longName: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  marketCap: number | null;
  exchange: string | null;
  currency: string | null;
  quoteType: string | null;
}

const QUOTE_CACHE_TTL_MS = 5000;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const PROFILE_CACHE_TTL_MS = 30 * 60 * 1000;
const MOST_ACTIVE_CACHE_TTL_MS = 60 * 1000;
const CHART_CACHE_TTL_MS = 10 * 60 * 1000;

function quoteCacheKey(symbol: string): string {
  return `quote:${symbol.toUpperCase()}`;
}

function searchCacheKey(query: string): string {
  return `search:${query.trim().toLowerCase()}`;
}

function profileCacheKey(symbol: string): string {
  return `profile:${symbol.toUpperCase()}`;
}

function chartCacheKey(symbol: string, interval: string): string {
  return `chart:${symbol.toUpperCase()}:${interval}`;
}

function mostActiveCacheKey(count: number): string {
  return `most-active:${count}`;
}

export async function getQuote(
  symbol: string,
  options: { maxAgeMs?: number } = {}
): Promise<Quote | null> {
  const maxAgeMs = options.maxAgeMs ?? QUOTE_CACHE_TTL_MS;
  const initialCacheKey = quoteCacheKey(symbol);

  if (maxAgeMs > 0) {
    const cached = await cacheGetJson<Quote>(initialCacheKey);
    if (cached) {
      const cachedAt = Date.parse(cached.timestamp);
      if (!Number.isNaN(cachedAt)) {
        const ageMs = Date.now() - cachedAt;
        if (ageMs <= maxAgeMs) {
          return cached;
        }
      } else {
        return cached;
      }
    }
  }

  try {
    // Convert crypto symbols to Yahoo format
    let yahooSymbol = symbol.toUpperCase();
    if (['BTC', 'ETH', 'SOL', 'DOGE', 'XRP'].includes(yahooSymbol)) {
      yahooSymbol = `${yahooSymbol}-USD`;
    }

    const result = await yahooFinance.quote(yahooSymbol) as any;
    
    if (!result || !result.regularMarketPrice) {
      return null;
    }

    const quote: Quote = {
      symbol: result.symbol || yahooSymbol,
      price: result.regularMarketPrice,
      change: result.regularMarketChange || 0,
      changePercent: result.regularMarketChangePercent || 0,
      volume: result.regularMarketVolume || 0,
      timestamp: new Date().toISOString(),
      marketState: result.marketState || null,
      regularMarketTime: result.regularMarketTime
        ? new Date(result.regularMarketTime).toISOString()
        : null,
    };

    const cacheKeys = new Set([initialCacheKey, quoteCacheKey(yahooSymbol)]);
    await Promise.all(
      Array.from(cacheKeys).map((key) => cacheSetJson(key, quote, QUOTE_CACHE_TTL_MS))
    );
    return quote;
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
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
  const cacheKey = searchCacheKey(query);
  const cached = await cacheGetJson<any[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const result = await yahooFinance.search(query, { quotesCount: 10 }) as any;
    
    const results = (result.quotes || [])
      .filter((q: any) => q.symbol && (q.shortname || q.longname))
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        type: q.quoteType || 'Equity',
        exchange: q.exchange || 'Unknown',
        currency: q.currency || 'USD',
      }));

    await cacheSetJson(cacheKey, results, SEARCH_CACHE_TTL_MS);
    return results;
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
    const cacheKey = chartCacheKey(symbol, interval);
    const cached = await cacheGetJson<ChartData[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const intervalMap: Record<string, '1d' | '1wk' | '1mo'> = {
      daily: '1d',
      weekly: '1wk',
      monthly: '1mo',
    };

    const result = await yahooFinance.chart(symbol.toUpperCase(), {
      period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
      period2: new Date(),
      interval: intervalMap[interval],
    }) as any;

    if (!result.quotes || result.quotes.length === 0) {
      return [];
    }

    const chart = result.quotes.map((q: any) => ({
      timestamp: new Date(q.date).toISOString().split('T')[0],
      open: q.open || 0,
      high: q.high || 0,
      low: q.low || 0,
      close: q.close || 0,
      volume: q.volume || 0,
    }));
    await cacheSetJson(cacheKey, chart, CHART_CACHE_TTL_MS);
    return chart;
  } catch (error) {
    console.error(`Error fetching chart data for ${symbol}:`, error);
    return [];
  }
}

export async function getProfileSummary(symbol: string): Promise<ProfileSummary | null> {
  const cacheKey = profileCacheKey(symbol);
  const cached = await cacheGetJson<ProfileSummary>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const result = await yahooFinance.quoteSummary(cacheKey, {
      modules: ['assetProfile', 'summaryProfile', 'price'],
    }) as any;

    const assetProfile = result?.assetProfile ?? {};
    const summaryProfile = result?.summaryProfile ?? {};
    const price = result?.price ?? {};

    const profile: ProfileSummary = {
      description: assetProfile.longBusinessSummary || summaryProfile.longBusinessSummary || null,
      sector: assetProfile.sector || summaryProfile.sector || null,
      industry: assetProfile.industry || summaryProfile.industry || null,
      website: assetProfile.website || summaryProfile.website || null,
      fullTimeEmployees: assetProfile.fullTimeEmployees ?? summaryProfile.fullTimeEmployees ?? null,
      longName: price.longName || null,
      shortName: price.shortName || null,
    };

    await cacheSetJson(cacheKey, profile, PROFILE_CACHE_TTL_MS);
    return profile;
  } catch (error) {
    console.error(`Error fetching profile for ${symbol}:`, error);
    return null;
  }
}

export async function getMostActiveStocks(count = 20): Promise<MostActiveQuote[]> {
  const safeCount = Math.min(Math.max(Math.floor(count), 1), 50);
  const cacheKey = mostActiveCacheKey(safeCount);
  const cached = await cacheGetJson<MostActiveQuote[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const result = await yahooFinance.screener({
      scrIds: 'most_actives',
      count: safeCount,
      region: 'US',
      lang: 'en-US',
    }) as any;

    const quotes = (result?.quotes || []).map((quote: any) => ({
      symbol: quote.symbol,
      shortName: quote.shortName || null,
      longName: quote.longName || null,
      price: quote.regularMarketPrice ?? null,
      change: quote.regularMarketChange ?? null,
      changePercent: quote.regularMarketChangePercent ?? null,
      volume: quote.regularMarketVolume ?? null,
      marketCap: quote.marketCap ?? null,
      exchange: quote.fullExchangeName || quote.exchange || null,
      currency: quote.currency || null,
      quoteType: quote.quoteType || null,
    })) as MostActiveQuote[];

    await cacheSetJson(cacheKey, quotes, MOST_ACTIVE_CACHE_TTL_MS);
    return quotes;
  } catch (error) {
    console.error('Error fetching most active stocks:', error);
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

    const quote = await getQuote(symbol, { maxAgeMs: 0 });
    if (quote) {
      subscribers.forEach((callback) => callback(quote));
    }

    setTimeout(poll, 10000); // Poll every 10 seconds
  };

  poll();
}
