import { FastifyInstance } from 'fastify';
import { authenticate } from '../auth.js';
import { query } from '../db.js';
import { getQuote } from '../marketData.js';

interface Strategy {
  id: number;
  user_id: number;
  name: string;
  cash_balance: number;
}

interface Position {
  symbol: string;
  quantity: number;
  average_cost: number;
}

interface LeaderboardEntry {
  rank: number;
  userId: number;
  displayName: string;
  strategyId: number;
  strategyName: string;
  netWorth: number;
  pnl: number;
  pnlPercent: number;
}

export async function leaderboardRoutes(fastify: FastifyInstance): Promise<void> {
  // Get leaderboard
  fastify.get('/api/leaderboard', { preHandler: authenticate }, async (request, reply) => {
    // Get all strategies with user info
    const strategies = await query<{
      id: number;
      name: string;
      cash_balance: number;
      user_id: number;
      display_name: string;
    }>(
      `SELECT s.id, s.name, s.cash_balance, s.user_id, u.display_name
       FROM strategies s
       JOIN users u ON s.user_id = u.id`
    );

    const leaderboard: LeaderboardEntry[] = [];

    for (const strategy of strategies) {
      // Get positions for this strategy
      const positions = await query<Position>(
        'SELECT symbol, quantity, average_cost FROM positions WHERE strategy_id = $1',
        [strategy.id]
      );

      // Calculate market value
      let totalMarketValue = 0;
      for (const pos of positions) {
        const quote = await getQuote(pos.symbol);
        const price = quote?.price || pos.average_cost;
        totalMarketValue += pos.quantity * price;
      }

      const netWorth = strategy.cash_balance + totalMarketValue;
      const startingBalance = 100000; // From config
      const pnl = netWorth - startingBalance;
      const pnlPercent = (pnl / startingBalance) * 100;

      leaderboard.push({
        rank: 0,
        userId: strategy.user_id,
        displayName: strategy.display_name,
        strategyId: strategy.id,
        strategyName: strategy.name,
        netWorth,
        pnl,
        pnlPercent,
      });
    }

    // Sort by net worth descending
    leaderboard.sort((a, b) => b.netWorth - a.netWorth);

    // Assign ranks
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return leaderboard;
  });
}
