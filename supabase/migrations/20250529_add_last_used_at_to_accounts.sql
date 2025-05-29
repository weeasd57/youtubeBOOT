-- Add last_used_at column to accounts table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'accounts' AND column_name = 'last_used_at'
    ) THEN
        ALTER TABLE accounts ADD COLUMN last_used_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add is_primary column to accounts table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'accounts' AND column_name = 'is_primary'
    ) THEN
        ALTER TABLE accounts ADD COLUMN is_primary BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Update existing accounts to have a last_used_at value
UPDATE accounts
SET last_used_at = updated_at
WHERE last_used_at IS NULL;

-- Set the first account for each user as primary if no primary exists
UPDATE accounts
SET is_primary = true
WHERE id IN (
    SELECT DISTINCT ON (owner_id) id
    FROM accounts
    WHERE owner_id NOT IN (
        SELECT DISTINCT owner_id
        FROM accounts
        WHERE is_primary = true
    )
    ORDER BY owner_id, created_at ASC
);

-- Add comments to the columns
COMMENT ON COLUMN accounts.last_used_at IS 'Timestamp when this account was last used/activated';
COMMENT ON COLUMN accounts.is_primary IS 'Whether this account is the primary account for the user';