import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase-server';

export async function GET() {
  try {
    console.log('Debug session endpoint called');
    
    const session = await getServerSession(authOptions);
    
    const debugInfo = {
      hasSession: !!session,
      sessionKeys: session ? Object.keys(session) : null,
      user: session?.user ? {
        email: session.user.email,
        name: session.user.name,
        id: session.user.id,
        auth_user_id: session.user.auth_user_id
      } : null,
      authUserId: session?.user?.auth_user_id,
      activeAccountId: session?.active_account_id,
      hasAccessToken: !!session?.accessToken,
      hasRefreshToken: !!session?.refreshToken,
      provider: session?.provider,
      error: session?.error
    };
    
    // If we have a user email but missing auth data, try to fetch from database
    if (session?.user?.email && (!session.user?.auth_user_id || !session.active_account_id)) {
      try {
        // Get the user's auth ID from Supabase
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserByEmail(session.user.email);
        
        if (!authError && authUser?.user?.id) {
          debugInfo.foundAuthUserId = authUser.user.id;
          
          // Get the primary account for this user
          const { data: primaryToken, error: tokenError } = await supabaseAdmin
            .from('user_tokens')
            .select('account_id, access_token, refresh_token, expires_at, is_primary')
            .eq('auth_user_id', authUser.user.id)
            .eq('is_primary', true)
            .single();
          
          if (!tokenError && primaryToken) {
            debugInfo.foundPrimaryAccount = {
              accountId: primaryToken.account_id,
              hasAccessToken: !!primaryToken.access_token,
              hasRefreshToken: !!primaryToken.refresh_token,
              expiresAt: primaryToken.expires_at,
              isPrimary: primaryToken.is_primary
            };
          } else {
            debugInfo.primaryAccountError = tokenError?.message || 'No primary account found';
          }
        } else {
          debugInfo.authUserError = authError?.message || 'Auth user not found';
        }
      } catch (error) {
        debugInfo.databaseError = error.message;
      }
    }
    
    return NextResponse.json(debugInfo);
  } catch (error) {
    console.error('Debug session endpoint error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}