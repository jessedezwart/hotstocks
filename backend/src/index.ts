import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { userRoutes } from './routes/users.js';
import { tradingRoutes } from './routes/trading.js';
import { marketRoutes } from './routes/market.js';
import { ledgerRoutes } from './routes/ledger.js';
import { leaderboardRoutes } from './routes/leaderboard.js';

const fastify = Fastify({
  logger: true,
});

async function main() {
  // Register plugins
  await fastify.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await fastify.register(websocket);

  // Register routes
  await fastify.register(userRoutes);
  await fastify.register(tradingRoutes);
  await fastify.register(marketRoutes);
  await fastify.register(ledgerRoutes);
  await fastify.register(leaderboardRoutes);

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));

  // Start server
  try {
    await fastify.listen({ port: config.port, host: config.host });
    console.log(`🚀 Hot Stocks API running at http://${config.host}:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
