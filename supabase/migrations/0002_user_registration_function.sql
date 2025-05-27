-- Create function to handle user registration in a transaction
CREATE OR REPLACE FUNCTION handle_user_registration(
    p_email TEXT,
    p_name TEXT,
    p_avatar_url TEXT,
    p_role TEXT DEFAULT 'user'
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_account_id uuid;
    v_result json;
BEGIN
    -- Start transaction
    BEGIN
        -- Insert or update user
        INSERT INTO public.users (email, name, avatar_url, role, created_at, updated_at)
        VALUES (p_email, p_name, p_avatar_url, p_role, NOW(), NOW())
        ON CONFLICT (email) 
        DO UPDATE SET
            name = EXCLUDED.name,
            avatar_url = EXCLUDED.avatar_url,
            updated_at = NOW()
        RETURNING id INTO v_user_id;

        -- Create account if it doesn't exist
        INSERT INTO public.user_accounts (user_id, name, email, created_at, updated_at)
        VALUES (v_user_id, p_name, p_email, NOW(), NOW())
        ON CONFLICT (user_id, email) 
        DO UPDATE SET
            name = EXCLUDED.name,
            updated_at = NOW()
        RETURNING id INTO v_account_id;

        -- Update user's active account
        UPDATE public.users
        SET active_account_id = v_account_id
        WHERE id = v_user_id
        AND (active_account_id IS NULL OR active_account_id != v_account_id);

        -- Prepare result
        SELECT json_build_object(
            'success', true,
            'user_id', v_user_id,
            'account_id', v_account_id
        ) INTO v_result;

        -- Commit transaction
        RETURN v_result;
    EXCEPTION WHEN OTHERS THEN
        -- Roll back transaction
        RAISE EXCEPTION 'Transaction failed: %', SQLERRM;
    END;
END;
$$;
