import { FastifyInstance } from 'fastify';
import { authenticate } from '../auth.js';
import { searchSymbols, getQuote, getChartData, getProfileSummary, getMostActiveStocks, subscribeToPriceUpdates } from '../marketData.js';

export async function marketRoutes(fastify: FastifyInstance): Promise<void> {
  // Search symbols
  fastify.get<{ Querystring: { q: string } }>(
    '/api/market/search',
    { preHandler: authenticate },
    async (request, reply) => {
      const { q } = request.query;
      
      if (!q || q.length < 1) {
        return [];
      }
      
      const results = await searchSymbols(q);
      return results;
    }
  );

  // Get quote
  fastify.get<{ Params: { symbol: string } }>(
    '/api/market/quote/:symbol',
    { preHandler: authenticate },
    async (request, reply) => {
      const { symbol } = request.params;
      const quote = await getQuote(symbol);
      
      if (!quote) {
        return reply.code(404).send({ error: 'Quote not found' });
      }
      
      return quote;
    }
  );

  // Get chart data
  fastify.get<{ Params: { symbol: string }; Querystring: { interval?: string } }>(
    '/api/market/chart/:symbol',
    { preHandler: authenticate },
    async (request, reply) => {
      const { symbol } = request.params;
      const interval = (request.query.interval || 'daily') as 'daily' | 'weekly' | 'monthly';
      
      const data = await getChartData(symbol, interval);
      return data;
    }
  );

  // Get profile summary
  fastify.get<{ Params: { symbol: string } }>(
    '/api/market/profile/:symbol',
    { preHandler: authenticate },
    async (request, reply) => {
      const { symbol } = request.params;
      const profile = await getProfileSummary(symbol);

      if (!profile) {
        return reply.code(404).send({ error: 'Profile not found' });
      }

      return profile;
    }
  );

  // Get most active stocks
  fastify.get<{ Querystring: { count?: string } }>(
    '/api/market/most-actives',
    { preHandler: authenticate },
    async (request, reply) => {
      const rawCount = request.query.count;
      const parsedCount = rawCount ? parseInt(rawCount, 10) : 20;
      const count = Number.isFinite(parsedCount) ? parsedCount : 20;
      const quotes = await getMostActiveStocks(count);
      return quotes;
    }
  );

  // WebSocket for real-time price updates
  fastify.get('/api/market/stream', { websocket: true }, (connection, request) => {
    const subscribedSymbols = new Map<string, () => void>();

    connection.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'subscribe' && data.symbol) {
          const symbol = data.symbol.toUpperCase();
          
          if (!subscribedSymbols.has(symbol)) {
            const unsubscribe = subscribeToPriceUpdates(symbol, (quote) => {
              connection.send(JSON.stringify({
                type: 'quote',
                data: quote,
              }));
            });
            subscribedSymbols.set(symbol, unsubscribe);
            
            // Send initial quote
            const quote = await getQuote(symbol);
            if (quote) {
              connection.send(JSON.stringify({
                type: 'quote',
                data: quote,
              }));
            }
          }
        } else if (data.type === 'unsubscribe' && data.symbol) {
          const symbol = data.symbol.toUpperCase();
          const unsubscribe = subscribedSymbols.get(symbol);
          if (unsubscribe) {
            unsubscribe();
            subscribedSymbols.delete(symbol);
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    connection.on('close', () => {
      // Cleanup all subscriptions
      subscribedSymbols.forEach((unsubscribe) => unsubscribe());
      subscribedSymbols.clear();
    });
  });
}
