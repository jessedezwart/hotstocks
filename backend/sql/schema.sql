-- Hot Stocks Database Schema
-- Virtual trading game with strategies (sub-accounts)

-- Users table (linked to Auth0)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    auth0_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Strategies (default A, B, C per user)
CREATE TABLE strategies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    cash_balance DECIMAL(15, 2) NOT NULL DEFAULT 100000.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Positions (holdings per strategy)
CREATE TABLE positions (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('stock', 'etf', 'crypto')),
    exchange VARCHAR(20),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    quantity DECIMAL(18, 8) NOT NULL DEFAULT 0,
    average_cost DECIMAL(15, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(strategy_id, symbol)
);

-- Immutable ledger for all transactions
CREATE TABLE ledger (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('fill', 'commission', 'adjustment', 'deposit', 'withdrawal')),
    symbol VARCHAR(20),
    side VARCHAR(4) CHECK (side IN ('buy', 'sell')),
    quantity DECIMAL(18, 8),
    price DECIMAL(15, 4),
    amount DECIMAL(15, 4) NOT NULL,
    commission DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Net worth snapshots for equity curve
CREATE TABLE net_worth_history (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    net_worth DECIMAL(15, 2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_ledger_strategy ON ledger(strategy_id);
CREATE INDEX idx_ledger_created_at ON ledger(created_at);
CREATE INDEX idx_positions_strategy ON positions(strategy_id);
CREATE INDEX idx_net_worth_strategy ON net_worth_history(strategy_id);
CREATE INDEX idx_net_worth_recorded_at ON net_worth_history(recorded_at);

-- Function to initialize strategies for a new user
CREATE OR REPLACE FUNCTION create_user_strategies()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO strategies (user_id, name) VALUES 
        (NEW.id, 'A'),
        (NEW.id, 'B'),
        (NEW.id, 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create strategies when a user is created
CREATE TRIGGER after_user_insert
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_user_strategies();
