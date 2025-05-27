import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (typeof window === 'undefined' && (!supabaseUrl || !supabaseServiceKey)) {
  console.error('Supabase URL or Service Role Key is missing. Please check your environment variables.');
}

export const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function saveUserToSupabase(user) {
  if (!user?.email) {
    console.error('saveUserToSupabase: No user email provided');
    return null;
  }

  const now = new Date().toISOString();

  try {
    // Begin transaction
    const { data: savedUser, error: userError } = await supabaseAdmin.rpc(
      'create_or_update_user',
      {
        p_email: user.email,
        p_name: user.name,
        p_avatar_url: user.image,
        p_updated_at: now
      }
    );

    if (userError) {
      console.error('Failed to save user:', userError);
      throw userError;
    }

    if (!savedUser?.id) {
      throw new Error('No user ID returned from create_or_update_user');
    }

    console.log('User saved successfully:', savedUser.id);
    return savedUser;
  } catch (error) {
    console.error('Error in saveUserToSupabase:', error);
    return null;
  }
}

export async function saveUserTokens({ email, accessToken, refreshToken, expiresAt }) {
  if (!email || !accessToken) {
    console.error('saveUserTokens: Missing required parameters');
    return null;
  }

  try {
    // Get user ID
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !user?.id) {
      console.error('User not found:', userError);
      return null;
    }

    const tokenData = {
      user_id: user.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: typeof expiresAt === 'number' ? expiresAt : Math.floor(Date.now() / 1000) + 3600,
      updated_at: new Date().toISOString()
    };

    // Save tokens
    const { data: savedTokens, error: tokenError } = await supabaseAdmin.rpc(
      'upsert_user_tokens',
      {
        p_user_id: user.id,
        p_access_token: tokenData.access_token,
        p_refresh_token: tokenData.refresh_token,
        p_expires_at: tokenData.expires_at,
        p_updated_at: tokenData.updated_at
      }
    );

    if (tokenError) {
      console.error('Failed to save tokens:', tokenError);
      throw tokenError;
    }

    console.log('Tokens saved successfully for user:', user.id);
    return savedTokens;
  } catch (error) {
    console.error('Error in saveUserTokens:', error);
    return null;
  }
}
