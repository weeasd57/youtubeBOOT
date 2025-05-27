-- Migration to update user_tokens table for multiple accounts support
-- Check if columns exist before adding them to avoid errors

-- Add provider_account_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_tokens' AND column_name = 'provider_account_id') THEN
        ALTER TABLE user_tokens ADD COLUMN provider_account_id TEXT;
    END IF;
END $$;

-- Add account_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_tokens' AND column_name = 'account_name') THEN
        ALTER TABLE user_tokens ADD COLUMN account_name TEXT;
    END IF;
END $$;

-- Add account_email column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_tokens' AND column_name = 'account_email') THEN
        ALTER TABLE user_tokens ADD COLUMN account_email TEXT;
    END IF;
END $$;

-- Add account_image column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_tokens' AND column_name = 'account_image') THEN
        ALTER TABLE user_tokens ADD COLUMN account_image TEXT;
    END IF;
END $$;

-- Add is_primary column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_tokens' AND column_name = 'is_primary') THEN
        ALTER TABLE user_tokens ADD COLUMN is_primary BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Add last_used_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_tokens' AND column_name = 'last_used_at') THEN
        ALTER TABLE user_tokens ADD COLUMN last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_tokens_provider_id ON user_tokens(provider_account_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_account ON user_tokens(user_email, account_email);
CREATE INDEX IF NOT EXISTS idx_user_tokens_primary ON user_tokens(user_email, is_primary);

-- Create function to set primary account
CREATE OR REPLACE FUNCTION set_primary_account(p_account_id UUID, p_user_email TEXT)
RETURNS JSONB AS $$
DECLARE
  v_old_primary_id UUID;
BEGIN
  -- Start transaction
  BEGIN
    -- Get current primary account
    SELECT id INTO v_old_primary_id 
    FROM user_tokens 
    WHERE user_email = p_user_email AND is_primary = true
    LIMIT 1;
    
    -- Update all accounts to non-primary
    UPDATE user_tokens 
    SET is_primary = false 
    WHERE user_email = p_user_email;
    
    -- Set new primary account
    UPDATE user_tokens 
    SET 
      is_primary = true,
      last_used_at = NOW()
    WHERE id = p_account_id AND user_email = p_user_email;
    
    -- Return success with old and new primary IDs
    RETURN jsonb_build_object(
      'success', true,
      'old_primary_id', v_old_primary_id,
      'new_primary_id', p_account_id
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback on error
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set first account as primary for each user if no primary exists
UPDATE user_tokens ut1
SET is_primary = true
WHERE NOT EXISTS (
  SELECT 1 FROM user_tokens ut2
  WHERE ut2.user_email = ut1.user_email AND ut2.is_primary = true
)
AND ut1.id IN (
  SELECT DISTINCT ON (user_email) id
  FROM user_tokens
  ORDER BY user_email, created_at ASC
);
