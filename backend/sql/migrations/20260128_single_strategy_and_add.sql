-- Migration: Users start with 1 strategy and can add more
-- Date: 2026-01-28

-- Update the trigger function to create only 1 strategy
CREATE OR REPLACE FUNCTION create_user_strategies()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO strategies (user_id, name) VALUES 
        (NEW.id, 'Strategy 1');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove unused strategies (cash_balance = 100000 and no positions/ledger entries)
-- Keep only the first strategy per user that meets this criteria
DELETE FROM strategies s
WHERE s.cash_balance = 100000.00
  AND NOT EXISTS (SELECT 1 FROM positions p WHERE p.strategy_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM ledger l WHERE l.strategy_id = s.id)
  AND s.id NOT IN (
    SELECT MIN(s2.id) 
    FROM strategies s2 
    WHERE s2.user_id = s.user_id
    GROUP BY s2.user_id
  );
