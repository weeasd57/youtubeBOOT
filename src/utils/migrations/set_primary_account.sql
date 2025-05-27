-- Function to set an account as primary while ensuring only one primary account per user
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
