import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

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

interface ProfileSummary {
  description: string | null;
  sector: string | null;
  industry: string | null;
  website: string | null;
  fullTimeEmployees: number | null;
  longName: string | null;
  shortName: string | null;
}

// Cache for quotes (expires after 15 seconds)
const quoteCache = new Map<string, { quote: Quote; timestamp: number }>();
const CACHE_TTL = 15000;

// Cache for search results (expires after 5 minutes)
const searchCache = new Map<string, { results: any[]; timestamp: number }>();
const SEARCH_CACHE_TTL = 300000;

// Cache for profile summaries (expires after 30 minutes)
const profileCache = new Map<string, { profile: ProfileSummary; timestamp: number }>();
const PROFILE_CACHE_TTL = 30 * 60 * 1000;

export async function getQuote(symbol: string): Promise<Quote | null> {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.quote;
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
    };

    quoteCache.set(symbol, { quote, timestamp: Date.now() });
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
  const cacheKey = query.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
    return cached.results;
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

    searchCache.set(cacheKey, { results, timestamp: Date.now() });
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

    return result.quotes.map((q: any) => ({
      timestamp: new Date(q.date).toISOString().split('T')[0],
      open: q.open || 0,
      high: q.high || 0,
      low: q.low || 0,
      close: q.close || 0,
      volume: q.volume || 0,
    }));
  } catch (error) {
    console.error(`Error fetching chart data for ${symbol}:`, error);
    return [];
  }
}

export async function getProfileSummary(symbol: string): Promise<ProfileSummary | null> {
  const cacheKey = symbol.toUpperCase();
  const cached = profileCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL) {
    return cached.profile;
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

    profileCache.set(cacheKey, { profile, timestamp: Date.now() });
    return profile;
  } catch (error) {
    console.error(`Error fetching profile for ${symbol}:`, error);
    return null;
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

    setTimeout(poll, 10000); // Poll every 10 seconds
  };

  poll();
}
