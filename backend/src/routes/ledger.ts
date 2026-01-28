import { FastifyInstance } from 'fastify';
import { authenticate } from '../auth.js';
import { query } from '../db.js';

interface LedgerEntry {
  id: number;
  strategy_id: number;
  entry_type: string;
  symbol: string | null;
  side: string | null;
  quantity: number | null;
  price: number | null;
  amount: number;
  commission: number;
  notes: string | null;
  created_at: string;
}

export async function ledgerRoutes(fastify: FastifyInstance): Promise<void> {
  // Get ledger entries for a strategy
  fastify.get<{ Params: { strategyId: string }; Querystring: { limit?: string; offset?: string } }>(
    '/api/strategies/:strategyId/ledger',
    { preHandler: authenticate },
    async (request, reply) => {
      const strategyId = parseInt(request.params.strategyId);
      const limit = parseInt(request.query.limit || '100');
      const offset = parseInt(request.query.offset || '0');

      const entries = await query<LedgerEntry>(
        `SELECT * FROM ledger 
         WHERE strategy_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [strategyId, limit, offset]
      );

      const countResult = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM ledger WHERE strategy_id = $1',
        [strategyId]
      );

      return {
        entries,
        total: parseInt(countResult[0]?.count || '0'),
        limit,
        offset,
      };
    }
  );

  // Export ledger as CSV
  fastify.get<{ Params: { strategyId: string } }>(
    '/api/strategies/:strategyId/ledger/export',
    { preHandler: authenticate },
    async (request, reply) => {
      const strategyId = parseInt(request.params.strategyId);

      const entries = await query<LedgerEntry>(
        `SELECT * FROM ledger 
         WHERE strategy_id = $1 
         ORDER BY created_at`,
        [strategyId]
      );

      // Build CSV
      const headers = ['Date', 'Type', 'Symbol', 'Side', 'Quantity', 'Price', 'Amount', 'Commission', 'Notes'];
      const rows = entries.map((e) => [
        e.created_at,
        e.entry_type,
        e.symbol || '',
        e.side || '',
        e.quantity?.toString() || '',
        e.price?.toString() || '',
        e.amount.toString(),
        e.commission.toString(),
        e.notes || '',
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="ledger-strategy-${strategyId}.csv"`);
      return csv;
    }
  );
}
