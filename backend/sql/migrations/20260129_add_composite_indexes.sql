-- Migration: Add composite indexes for strategy/time lookups
-- Date: 2026-01-29

CREATE INDEX IF NOT EXISTS idx_ledger_strategy_created_at
  ON ledger(strategy_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_net_worth_strategy_recorded_at
  ON net_worth_history(strategy_id, recorded_at DESC);
