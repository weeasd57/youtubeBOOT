import { NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * API endpoint to fetch user tokens with improved timeout handling and performance
 */
export async function GET(request) {
  // Define controller and timeout at the top to ensure availability in all blocks
  let controller;
  let timeout;

  try {
    controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

    const { searchParams } = new URL(request.url);
    const emailParam = searchParams.get('email');
    
    // Get user email
    const session = await getSession();
    const userEmail = emailParam || session?.user?.email;

    if (!userEmail) {
      console.log('No email found, returning empty tokens');
      return NextResponse.json({ tokens: [] });
    }

    // Execute optimized query with only required fields
    const { data: tokens, error } = await supabaseAdmin
      .from('user_tokens')
      .select('id, access_token, refresh_token, expires_at, user_email')
      .eq('user_email', userEmail);

    if (error) {
      console.error('Token fetch error:', error.message);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch tokens' },
        { status: 500 }
      );
    }

    // Format tokens for client
    const formattedTokens = (tokens || []).map(token => ({
      id: token.id,
      name: `Account ${token.id.substring(0, 6)}...`,
      email: token.user_email,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_at
    }));

    return NextResponse.json({ tokens: formattedTokens }, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300' // 5 minutes cache
      }
    });
    
  } catch (error) {
    // Handle timeout specifically
    if (error.name === 'AbortError') {
      console.warn('Token fetch request timed out after 15 seconds');
      return NextResponse.json(
        { error: 'Token fetch request timed out' },
        { status: 408 } // Request Timeout status
      );
    }
    
    console.error('Server error in tokens API:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
    
  } finally {
    // Ensure timeout is cleared to prevent memory leaks
    if (timeout) clearTimeout(timeout);
  }
}