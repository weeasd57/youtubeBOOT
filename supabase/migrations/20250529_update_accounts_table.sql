-- Migration: Update accounts table with missing columns
-- Date: 2025-05-29
-- Description: Add missing columns to accounts table to match application requirements

-- Add missing columns to accounts table
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS image TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records to have created_at if null
UPDATE accounts 
SET created_at = NOW() 
WHERE created_at IS NULL;

-- Set the first account for each owner as primary if no primary exists
WITH first_accounts AS (
  SELECT DISTINCT ON (owner_id) 
    id, 
    owner_id
  FROM accounts 
  ORDER BY owner_id, created_at ASC
)
UPDATE accounts 
SET is_primary = TRUE 
WHERE id IN (
  SELECT fa.id 
  FROM first_accounts fa
  WHERE NOT EXISTS (
    SELECT 1 
    FROM accounts a2 
    WHERE a2.owner_id = fa.owner_id 
    AND a2.is_primary = TRUE
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_accounts_owner_id ON accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_accounts_parent_account_id ON accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_is_primary ON accounts(is_primary) WHERE is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_accounts_is_active ON accounts(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_accounts_last_used_at ON accounts(last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON accounts(created_at DESC);

-- Add constraints
ALTER TABLE accounts 
ADD CONSTRAINT chk_account_type 
CHECK (account_type IN ('google', 'primary', 'sub'));

-- Ensure only one primary account per owner
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_unique_primary 
ON accounts(owner_id) 
WHERE is_primary = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN accounts.is_primary IS 'Indicates if this is the primary account for the owner';
COMMENT ON COLUMN accounts.last_used_at IS 'Timestamp when the account was last used/activated';
COMMENT ON COLUMN accounts.is_active IS 'Indicates if the account is currently active';
COMMENT ON COLUMN accounts.email IS 'Email address associated with the account';
COMMENT ON COLUMN accounts.image IS 'Profile image URL for the account';
COMMENT ON COLUMN accounts.description IS 'Optional description for the account';
COMMENT ON COLUMN accounts.created_at IS 'Timestamp when the account was created';
-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on row changes
DROP TRIGGER IF EXISTS trigger_accounts_updated_at ON accounts;
CREATE TRIGGER trigger_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_accounts_updated_at();

-- Create function to ensure only one primary account per owner
CREATE OR REPLACE FUNCTION ensure_single_primary_account()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting an account as primary, unset all other primary accounts for the same owner
  IF NEW.is_primary = TRUE AND (OLD.is_primary IS NULL OR OLD.is_primary = FALSE) THEN
    UPDATE accounts 
    SET is_primary = FALSE 
    WHERE owner_id = NEW.owner_id 
    AND id != NEW.id 
    AND is_primary = TRUE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure only one primary account per owner
DROP TRIGGER IF EXISTS trigger_ensure_single_primary ON accounts;
CREATE TRIGGER trigger_ensure_single_primary
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_primary_account();

-- Create function to update last_used_at when account is activated
CREATE OR REPLACE FUNCTION update_account_last_used()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_used_at when account is accessed/activated
  NEW.last_used_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON accounts TO authenticated;
-- GRANT USAGE ON SEQUENCE accounts_id_seq TO authenticated;

-- Create view for account statistics (optional)
CREATE OR REPLACE VIEW account_stats AS
SELECT 
  owner_id,
  COUNT(*) as total_accounts,
  COUNT(CASE WHEN is_primary THEN 1 END) as primary_accounts,
  COUNT(CASE WHEN is_active THEN 1 END) as active_accounts,
  COUNT(CASE WHEN account_type = 'google' THEN 1 END) as google_accounts,
  COUNT(CASE WHEN account_type = 'sub' THEN 1 END) as sub_accounts,
  MAX(last_used_at) as last_activity,
  MIN(created_at) as first_account_created
FROM accounts
GROUP BY owner_id;

-- Add RLS (Row Level Security) policies if needed
-- ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see only their own accounts
-- CREATE POLICY "Users can view own accounts" ON accounts
--   FOR SELECT USING (owner_id = auth.uid());

-- Policy to allow users to update only their own accounts
-- CREATE POLICY "Users can update own accounts" ON accounts
--   FOR UPDATE USING (owner_id = auth.uid());

-- Policy to allow users to insert accounts for themselves
-- CREATE POLICY "Users can insert own accounts" ON accounts
--   FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Policy to allow users to delete their own non-primary accounts
-- CREATE POLICY "Users can delete own non-primary accounts" ON accounts
--   FOR DELETE USING (owner_id = auth.uid() AND is_primary = FALSE);