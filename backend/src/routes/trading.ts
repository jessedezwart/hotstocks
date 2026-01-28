import { FastifyInstance } from 'fastify';
import { authenticate } from '../auth.js';
import { execute, query, queryOne } from '../db.js';
import { getQuote } from '../marketData.js';
import { config } from '../config.js';

interface Strategy {
  id: number;
  user_id: number;
  name: string;
  cash_balance: number;
}

interface Position {
  id: number;
  strategy_id: number;
  symbol: string;
  asset_type: string;
  exchange: string;
  currency: string;
  quantity: number;
  average_cost: number;
}

interface TradeRequest {
  strategyId: number;
  symbol: string;
  side: 'buy' | 'sell';
  quantity?: number;
  notionalAmount?: number;
  assetType: 'stock' | 'etf' | 'crypto';
  exchange?: string;
  currency?: string;
}

const SNAPSHOT_MIN_INTERVAL_MINUTES = 60;
const MS_PER_MINUTE = 60 * 1000;

async function computeNetWorth(strategyId: number): Promise<number | null> {
  const strategy = await queryOne<Strategy>('SELECT * FROM strategies WHERE id = $1', [strategyId]);
  if (!strategy) return null;

  const positions = await query<Position>(
    'SELECT * FROM positions WHERE strategy_id = $1',
    [strategyId]
  );

  const marketValues = await Promise.all(
    positions.map(async (pos) => {
      const quote = await getQuote(pos.symbol);
      const currentPrice = quote?.price || parseFloat(pos.average_cost.toString());
      const quantity = parseFloat(pos.quantity.toString());
      return quantity * currentPrice;
    })
  );

  const totalMarketValue = marketValues.reduce((sum, value) => sum + value, 0);

  const cashBalance = parseFloat(strategy.cash_balance.toString());
  return cashBalance + totalMarketValue;
}

async function insertNetWorthSnapshot(strategyId: number, netWorth: number): Promise<void> {
  await execute(
    'INSERT INTO net_worth_history (strategy_id, net_worth) VALUES ($1, $2)',
    [strategyId, netWorth]
  );
}

async function maybeSnapshotNetWorth(strategyId: number, netWorth: number): Promise<void> {
  const latest = await queryOne<{ recorded_at: string }>(
    `SELECT recorded_at FROM net_worth_history 
     WHERE strategy_id = $1 
     ORDER BY recorded_at DESC 
     LIMIT 1`,
    [strategyId]
  );

  if (!latest) {
    await insertNetWorthSnapshot(strategyId, netWorth);
    return;
  }

  const ageMs = Date.now() - new Date(latest.recorded_at).getTime();
  if (ageMs >= SNAPSHOT_MIN_INTERVAL_MINUTES * MS_PER_MINUTE) {
    await insertNetWorthSnapshot(strategyId, netWorth);
  }
}

export async function tradingRoutes(fastify: FastifyInstance): Promise<void> {
  // Execute a trade
  fastify.post('/api/trade', { preHandler: authenticate }, async (request, reply) => {
    const auth0Id = request.user!.sub;
    const trade = request.body as TradeRequest;

    // Verify strategy belongs to user
    const strategy = await queryOne<Strategy>(
      `SELECT s.* FROM strategies s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1 AND u.auth0_id = $2`,
      [trade.strategyId, auth0Id]
    );

    if (!strategy) {
      return reply.code(403).send({ error: 'Strategy not found or access denied' });
    }

    // Get current quote
    const quote = await getQuote(trade.symbol);
    if (!quote) {
      return reply.code(400).send({ error: 'Unable to get quote for symbol' });
    }

    const price = quote.price;
    const commission = config.trading.commissionFee;

    // Calculate quantity if notional amount provided
    let quantity = trade.quantity;
    if (!quantity && trade.notionalAmount) {
      quantity = trade.notionalAmount / price;
    }
    
    if (!quantity || quantity <= 0) {
      return reply.code(400).send({ error: 'Invalid quantity' });
    }

    const tradeAmount = quantity * price;
    const totalCost = trade.side === 'buy' ? tradeAmount + commission : -tradeAmount + commission;

    // Check if user has enough cash for buy
    if (trade.side === 'buy' && strategy.cash_balance < tradeAmount + commission) {
      return reply.code(400).send({ error: 'Insufficient funds' });
    }

    // For sells, check if user has enough shares
    if (trade.side === 'sell') {
      const position = await queryOne<Position>(
        'SELECT * FROM positions WHERE strategy_id = $1 AND symbol = $2',
        [trade.strategyId, trade.symbol]
      );
      
      if (!position || position.quantity < quantity) {
        return reply.code(400).send({ error: 'Insufficient shares' });
      }
    }

    // Execute trade in transaction
    const client = await (await import('../db.js')).pool.connect();
    
    try {
      await client.query('BEGIN');

      // Update cash balance
      const newCashBalance = trade.side === 'buy'
        ? strategy.cash_balance - tradeAmount - commission
        : strategy.cash_balance + tradeAmount - commission;

      await client.query(
        'UPDATE strategies SET cash_balance = $1, updated_at = NOW() WHERE id = $2',
        [newCashBalance, trade.strategyId]
      );

      // Update or create position
      const existingPosition = await client.query(
        'SELECT * FROM positions WHERE strategy_id = $1 AND symbol = $2',
        [trade.strategyId, trade.symbol]
      );

      if (existingPosition.rows.length > 0) {
        const pos = existingPosition.rows[0];
        let newQuantity: number;
        let newAverageCost: number;

        if (trade.side === 'buy') {
          const totalShares = parseFloat(pos.quantity) + quantity;
          const totalCostBasis = parseFloat(pos.quantity) * parseFloat(pos.average_cost) + quantity * price;
          newQuantity = totalShares;
          newAverageCost = totalCostBasis / totalShares;
        } else {
          newQuantity = parseFloat(pos.quantity) - quantity;
          newAverageCost = parseFloat(pos.average_cost);
        }

        if (newQuantity <= 0) {
          await client.query('DELETE FROM positions WHERE id = $1', [pos.id]);
        } else {
          await client.query(
            'UPDATE positions SET quantity = $1, average_cost = $2, updated_at = NOW() WHERE id = $3',
            [newQuantity, newAverageCost, pos.id]
          );
        }
      } else if (trade.side === 'buy') {
        await client.query(
          `INSERT INTO positions (strategy_id, symbol, asset_type, exchange, currency, quantity, average_cost)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            trade.strategyId,
            trade.symbol,
            trade.assetType,
            trade.exchange || 'NYSE',
            trade.currency || 'USD',
            quantity,
            price,
          ]
        );
      }

      // Record fill in ledger
      await client.query(
        `INSERT INTO ledger (strategy_id, entry_type, symbol, side, quantity, price, amount, commission)
         VALUES ($1, 'fill', $2, $3, $4, $5, $6, $7)`,
        [trade.strategyId, trade.symbol, trade.side, quantity, price, tradeAmount, commission]
      );

      // Record commission in ledger
      await client.query(
        `INSERT INTO ledger (strategy_id, entry_type, amount, notes)
         VALUES ($1, 'commission', $2, $3)`,
        [trade.strategyId, -commission, `Commission for ${trade.side} ${quantity} ${trade.symbol}`]
      );

      await client.query('COMMIT');

      try {
        const netWorth = await computeNetWorth(trade.strategyId);
        if (netWorth !== null) {
          await insertNetWorthSnapshot(trade.strategyId, netWorth);
        }
      } catch (snapshotError) {
        request.log.error({ err: snapshotError }, 'Failed to snapshot net worth after trade');
      }

      return {
        success: true,
        fill: {
          symbol: trade.symbol,
          side: trade.side,
          quantity,
          price,
          amount: tradeAmount,
          commission,
          newCashBalance,
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Trade error:', error);
      return reply.code(500).send({ error: 'Trade execution failed' });
    } finally {
      client.release();
    }
  });

  // Get positions for a strategy
  fastify.get<{ Params: { strategyId: string } }>(
    '/api/strategies/:strategyId/positions',
    { preHandler: authenticate },
    async (request, reply) => {
      const strategyId = parseInt(request.params.strategyId);
      const auth0Id = request.user!.sub;

      // Verify access (own strategy or friend's strategy)
      const strategy = await queryOne<Strategy>(
        `SELECT s.* FROM strategies s
         JOIN users u ON s.user_id = u.id
         WHERE s.id = $1`,
        [strategyId]
      );

      if (!strategy) {
        return reply.code(404).send({ error: 'Strategy not found' });
      }

      const positions = await query<Position>(
        'SELECT * FROM positions WHERE strategy_id = $1 ORDER BY symbol',
        [strategyId]
      );

      // Enrich with current prices
      const enrichedPositions = await Promise.all(
        positions.map(async (pos) => {
          const quote = await getQuote(pos.symbol);
          const quantity = parseFloat(pos.quantity.toString());
          const averageCost = parseFloat(pos.average_cost.toString());
          const currentPrice = quote?.price || averageCost;
          const marketValue = quantity * currentPrice;
          const costBasis = quantity * averageCost;
          const unrealizedPnl = marketValue - costBasis;
          const unrealizedPnlPercent = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;

          return {
            ...pos,
            quantity,
            average_cost: averageCost,
            currentPrice,
            marketValue,
            costBasis,
            unrealizedPnl,
            unrealizedPnlPercent,
          };
        })
      );

      return enrichedPositions;
    }
  );

  // Get portfolio summary
  fastify.get<{ Params: { strategyId: string } }>(
    '/api/strategies/:strategyId/portfolio',
    { preHandler: authenticate },
    async (request, reply) => {
      const strategyId = parseInt(request.params.strategyId);

      const strategy = await queryOne<Strategy>(
        'SELECT * FROM strategies WHERE id = $1',
        [strategyId]
      );

      if (!strategy) {
        return reply.code(404).send({ error: 'Strategy not found' });
      }

      const positions = await query<Position>(
        'SELECT * FROM positions WHERE strategy_id = $1',
        [strategyId]
      );

      let totalMarketValue = 0;
      let totalCostBasis = 0;
      const allocationByType: Record<string, number> = {};
      const allocationByCurrency: Record<string, number> = {};

      for (const pos of positions) {
        const quote = await getQuote(pos.symbol);
        const currentPrice = quote?.price || parseFloat(pos.average_cost.toString());
        const marketValue = parseFloat(pos.quantity.toString()) * currentPrice;
        const costBasis = parseFloat(pos.quantity.toString()) * parseFloat(pos.average_cost.toString());

        totalMarketValue += marketValue;
        totalCostBasis += costBasis;

        allocationByType[pos.asset_type] = (allocationByType[pos.asset_type] || 0) + marketValue;
        allocationByCurrency[pos.currency] = (allocationByCurrency[pos.currency] || 0) + marketValue;
      }

      const cashBalance = parseFloat(strategy.cash_balance.toString());
      const netWorth = cashBalance + totalMarketValue;
      const totalPnl = netWorth - config.trading.startingBalance;
      const totalPnlPercent = (totalPnl / config.trading.startingBalance) * 100;

      try {
        await maybeSnapshotNetWorth(strategyId, netWorth);
      } catch (snapshotError) {
        request.log.error({ err: snapshotError }, 'Failed to snapshot net worth on portfolio load');
      }

      return {
        strategyId,
        strategyName: strategy.name,
        cashBalance,
        totalMarketValue,
        netWorth,
        totalPnl,
        totalPnlPercent,
        totalCostBasis,
        unrealizedPnl: totalMarketValue - totalCostBasis,
        allocationByType,
        allocationByCurrency,
      };
    }
  );

  // Get net worth history for equity curve
  fastify.get<{ Params: { strategyId: string } }>(
    '/api/strategies/:strategyId/net-worth-history',
    { preHandler: authenticate },
    async (request, reply) => {
      const strategyId = parseInt(request.params.strategyId);

      const history = await query<{ net_worth: number; recorded_at: string }>(
        `SELECT net_worth, recorded_at FROM net_worth_history 
         WHERE strategy_id = $1 
         ORDER BY recorded_at`,
        [strategyId]
      );

      return history;
    }
  );
}
