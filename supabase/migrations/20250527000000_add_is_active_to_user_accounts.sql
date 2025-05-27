-- Add is_active column to user_accounts table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_accounts' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE user_accounts ADD COLUMN is_active boolean DEFAULT true;
    END IF;
END $$;

-- Set existing accounts to active
UPDATE user_accounts SET is_active = true WHERE is_active IS NULL;

-- Add a constraint to ensure is_active is not null
ALTER TABLE user_accounts ALTER COLUMN is_active SET NOT NULL;
