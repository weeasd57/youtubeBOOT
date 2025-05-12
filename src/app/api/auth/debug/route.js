import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase';

export async function GET(request) {
  try {
    // Get the current session
    const session = await getServerSession(authOptions);
    
    // No session - user isn't logged in
    if (!session) {
      return NextResponse.json({ 
        status: 'unauthenticated',
        message: 'No active session found. User is not logged in.' 
      });
    }
    
    // Get user email from session
    const userEmail = session.user?.email;
    
    if (!userEmail) {
      return NextResponse.json({ 
        status: 'error',
        message: 'No email found in session' 
      });
    }
    
    // Get the user's tokens from the database
    const { data: userTokens, error } = await supabaseAdmin
      .from('user_tokens')
      .select('*')
      .eq('user_email', userEmail)
      .single();
    
    if (error || !userTokens) {
      return NextResponse.json({ 
        status: 'error',
        message: 'Failed to get user tokens from database',
        error: error?.message || 'No tokens found'
      });
    }
    
    // Return token information (don't include actual tokens for security)
    return NextResponse.json({
      status: 'authenticated',
      user: {
        email: userEmail,
        name: session.user?.name,
        image: session.user?.image
      },
      tokenInfo: {
        hasAccessToken: !!userTokens.access_token,
        hasRefreshToken: !!userTokens.refresh_token,
        scopes: userTokens.scopes || 'No scopes stored',
        expiresAt: userTokens.expires_at ? new Date(userTokens.expires_at * 1000).toISOString() : 'No expiry date',
        isValid: userTokens.is_valid !== false,
        lastUpdated: userTokens.updated_at,
        errorMessage: userTokens.error_message || null
      }
    });
  } catch (error) {
    console.error('Error in auth debug route:', error);
    return NextResponse.json({ 
      status: 'error',
      message: 'Internal server error', 
      error: error.message 
    }, { status: 500 });
  }
} 