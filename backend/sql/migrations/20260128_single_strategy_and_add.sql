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
