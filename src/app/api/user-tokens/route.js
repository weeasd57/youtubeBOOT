import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/utils/session';

/**
 * API endpoint to fetch user tokens from the user_tokens table
 */
export async function GET(request) {
  try {
    // Create Supabase client
    const cookieStore = cookies();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false
        }
      }
    );
    
    // Try to get the session to authenticate the request
    const session = await getSession();
    let authUserId = session?.authUserId;
    
    // If we have no session or auth user ID, get all tokens
    // This is a fallback mode for development or when session isn't available
    if (!authUserId) {
      console.log('No authenticated user found, fetching all tokens');
      
      // Query all tokens (limit for safety)
      const { data, error } = await supabase
        .from('user_tokens')
        .select('*')
        .limit(100);
      
      if (error) {
        console.error('Error fetching all tokens:', error);
        return NextResponse.json(
          { error: 'Failed to fetch tokens', details: error.message },
          { status: 500 }
        );
      }
      
      console.log(`API route /api/user-tokens: Found ${data?.length || 0} tokens (no user filter)`);
      
      // Format the tokens for the frontend
      const tokens = data.map(token => ({
        id: token.account_id || token.id,
        name: token.name || `Account ${token.account_id?.substring(0, 6)}...`,
        email: token.email || null,
        accessToken: token.access_token || null,
        refreshToken: token.refresh_token || null,
        tokenType: token.token_type || null,
        expiresAt: token.expires_at || null,
        authUserId: token.auth_user_id
      }));
      
      return NextResponse.json({ tokens });
    }
    
    // If we have an auth user ID, filter by it
    console.log(`Fetching tokens for auth user ID: ${authUserId}`);
    
    // Query the user_tokens table
    const { data, error } = await supabase
      .from('user_tokens')
      .select('*')
      .eq('auth_user_id', authUserId);
    
    if (error) {
      console.error('Error fetching user tokens:', error);
      return NextResponse.json(
        { error: 'Failed to fetch user tokens', details: error.message },
        { status: 500 }
      );
    }
    
    console.log(`API route /api/user-tokens: Found ${data?.length || 0} tokens for user ${authUserId}`);
    
    // Format the tokens for the frontend
    const tokens = data.map(token => ({
      id: token.account_id || token.id,
      name: token.name || `Account ${token.account_id?.substring(0, 6)}...`,
      email: token.email || null,
      accessToken: token.access_token || null,
      refreshToken: token.refresh_token || null,
      tokenType: token.token_type || null,
      expiresAt: token.expires_at || null
    }));
    
    return NextResponse.json({ tokens });
  } catch (error) {
    console.error('Error in user tokens API route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
} 