import YahooFinance from 'yahoo-finance2';
import { pool } from '../db.js';
import { config } from '../config.js';

type LedgerEntry = {
  entry_type: string;
  symbol: string | null;
  side: 'buy' | 'sell' | null;
  quantity: string | number | null;
  amount: string | number | null;
  created_at: string;
};

type StrategyRow = {
  id: number;
  cash_balance: string | number;
  created_at: string;
};

const yahooFinance = new YahooFinance();
const CRYPTO_SYMBOLS = new Set(['BTC', 'ETH', 'SOL', 'DOGE', 'XRP']);

function parseArgValue(name: string): string | null {
  const prefix = `--${name}`;
  const argv = process.argv.slice(2);
  const direct = argv.find((arg) => arg.startsWith(`${prefix}=`));
  if (direct) {
    return direct.split('=').slice(1).join('=') || null;
  }
  const index = argv.indexOf(prefix);
  if (index >= 0 && argv[index + 1]) {
    return argv[index + 1];
  }
  return null;
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (current <= end) {
    dates.push(toDateKey(current));
    current = addDays(current, 1);
  }
  return dates;
}

function toYahooSymbol(symbol: string): string {
  const normalized = symbol.toUpperCase();
  if (!normalized.includes('-') && CRYPTO_SYMBOLS.has(normalized)) {
    return `${normalized}-USD`;
  }
  return normalized;
}

async function fetchDailyCloses(symbol: string, startDate: string, endDate: string, dateKeys: string[]): Promise<Map<string, number>> {
  const yahooSymbol = toYahooSymbol(symbol);
  const period1 = new Date(`${startDate}T00:00:00.000Z`);
  const period2 = addDays(new Date(`${endDate}T00:00:00.000Z`), 1);
  const priceByDate = new Map<string, number>();

  try {
    const result = await yahooFinance.chart(yahooSymbol, {
      period1,
      period2,
      interval: '1d',
    }) as any;

    const quotes = result?.quotes || [];
    for (const quote of quotes) {
      if (!quote?.date || quote.close == null) continue;
      const key = toDateKey(new Date(quote.date));
      priceByDate.set(key, Number(quote.close));
    }
  } catch (error) {
    console.error(`Failed to fetch chart for ${symbol}:`, error);
  }

  const filled = new Map<string, number>();
  let lastClose: number | null = null;
  for (const dateKey of dateKeys) {
    const close = priceByDate.get(dateKey);
    if (close != null && Number.isFinite(close)) {
      lastClose = close;
    }
    if (lastClose != null) {
      filled.set(dateKey, lastClose);
    }
  }

  return filled;
}

async function insertSnapshots(strategyId: number, snapshots: Array<{ recorded_at: string; net_worth: number }>): Promise<void> {
  const batchSize = 500;
  for (let i = 0; i < snapshots.length; i += batchSize) {
    const batch = snapshots.slice(i, i + batchSize);
    const values: Array<string | number> = [];
    const placeholders = batch
      .map((snapshot, index) => {
        const base = index * 3;
        values.push(strategyId, snapshot.net_worth, snapshot.recorded_at);
        return `($${base + 1}, $${base + 2}, $${base + 3})`;
      })
      .join(', ');

    await pool.query(
      `INSERT INTO net_worth_history (strategy_id, net_worth, recorded_at)
       VALUES ${placeholders}`,
      values
    );
  }
}

async function backfillStrategy(
  strategy: StrategyRow,
  startDate: string,
  endDate: string,
  keepExisting: boolean,
  dryRun: boolean
): Promise<void> {
  const ledgerEntries = await pool.query<LedgerEntry>(
    `SELECT entry_type, symbol, side, quantity, amount, created_at
     FROM ledger
     WHERE strategy_id = $1
     ORDER BY created_at`,
    [strategy.id]
  );

  const entries = ledgerEntries.rows;
  const strategyCreatedDate = toDateKey(new Date(strategy.created_at));
  const effectiveStart = startDate || (entries[0] ? toDateKey(new Date(entries[0].created_at)) : strategyCreatedDate);
  const effectiveEnd = endDate || toDateKey(new Date());
  const dateKeys = buildDateRange(effectiveStart, effectiveEnd);

  if (!keepExisting && !dryRun) {
    await pool.query('DELETE FROM net_worth_history WHERE strategy_id = $1', [strategy.id]);
  }

  if (entries.length === 0) {
    const netWorth = Number(strategy.cash_balance) || config.trading.startingBalance;
    const snapshotDate = `${effectiveEnd}T00:00:00.000Z`;
    if (dryRun) {
      console.log(`Strategy ${strategy.id}: no ledger entries, would insert 1 snapshot on ${effectiveEnd}.`);
      return;
    }
    await insertSnapshots(strategy.id, [{ recorded_at: snapshotDate, net_worth: netWorth }]);
    console.log(`Strategy ${strategy.id}: inserted 1 snapshot (no ledger entries).`);
    return;
  }

  const symbols = Array.from(
    new Set(entries.filter((entry) => entry.entry_type === 'fill' && entry.symbol).map((entry) => entry.symbol as string))
  );

  const priceBySymbol = new Map<string, Map<string, number>>();
  for (const symbol of symbols) {
    const prices = await fetchDailyCloses(symbol, effectiveStart, effectiveEnd, dateKeys);
    priceBySymbol.set(symbol, prices);
  }

  const positions = new Map<string, number>();
  let cashBalance = config.trading.startingBalance;
  let entryIndex = 0;
  const snapshots: Array<{ recorded_at: string; net_worth: number }> = [];

  for (const dateKey of dateKeys) {
    while (entryIndex < entries.length) {
      const entry = entries[entryIndex];
      const entryDateKey = toDateKey(new Date(entry.created_at));
      if (entryDateKey > dateKey) break;

      const amount = Number(entry.amount ?? 0);
      const quantity = Number(entry.quantity ?? 0);

      if (entry.entry_type === 'fill' && entry.symbol && entry.side) {
        const currentQty = positions.get(entry.symbol) || 0;
        if (entry.side === 'buy') {
          positions.set(entry.symbol, currentQty + quantity);
          cashBalance -= amount;
        } else {
          positions.set(entry.symbol, currentQty - quantity);
          cashBalance += amount;
        }
      } else if (['commission', 'deposit', 'withdrawal', 'adjustment'].includes(entry.entry_type)) {
        cashBalance += amount;
      }

      entryIndex += 1;
    }

    let totalMarketValue = 0;
    for (const [symbol, quantity] of positions.entries()) {
      if (quantity === 0) continue;
      const priceMap = priceBySymbol.get(symbol);
      const close = priceMap?.get(dateKey);
      if (close == null) continue;
      totalMarketValue += quantity * close;
    }

    const netWorth = cashBalance + totalMarketValue;
    snapshots.push({
      recorded_at: `${dateKey}T00:00:00.000Z`,
      net_worth: Number(netWorth.toFixed(2)),
    });
  }

  if (dryRun) {
    console.log(`Strategy ${strategy.id}: would insert ${snapshots.length} snapshots (${effectiveStart} → ${effectiveEnd}).`);
    return;
  }

  await insertSnapshots(strategy.id, snapshots);

  const cashDifference = Number(strategy.cash_balance) - cashBalance;
  if (Math.abs(cashDifference) > 1) {
    console.warn(
      `Strategy ${strategy.id}: computed cash ${cashBalance.toFixed(2)} differs from current ${Number(strategy.cash_balance).toFixed(2)}`
    );
  }

  console.log(`Strategy ${strategy.id}: inserted ${snapshots.length} snapshots.`);
}

async function main(): Promise<void> {
  const strategyIdRaw = parseArgValue('strategyId');
  const fromArg = parseArgValue('from');
  const toArg = parseArgValue('to');
  const keepExisting = hasFlag('keep-existing');
  const dryRun = hasFlag('dry-run');

  const strategyId = strategyIdRaw ? Number(strategyIdRaw) : null;
  if (strategyIdRaw && !Number.isFinite(strategyId)) {
    throw new Error('Invalid --strategyId value');
  }

  const strategies = await pool.query<StrategyRow>(
    strategyId ? 'SELECT id, cash_balance, created_at FROM strategies WHERE id = $1' : 'SELECT id, cash_balance, created_at FROM strategies',
    strategyId ? [strategyId] : []
  );

  if (strategies.rows.length === 0) {
    console.log('No strategies found.');
    return;
  }

  for (const strategy of strategies.rows) {
    await backfillStrategy(strategy, fromArg || '', toArg || '', keepExisting, dryRun);
  }
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
