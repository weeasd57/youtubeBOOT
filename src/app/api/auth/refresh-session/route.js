import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../[...nextauth]/options';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST() {
  try {
    console.log('Session refresh endpoint called');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ 
        success: false, 
        error: 'No valid session found' 
      }, { status: 401 });
    }
    
    // Get the user's auth ID from Supabase
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserByEmail(session.user.email);
    
    if (authError || !authUser?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found in authentication system' 
      }, { status: 404 });
    }
    
    // Get the primary account for this user
    const { data: primaryToken, error: tokenError } = await supabaseAdmin
      .from('user_tokens')
      .select('account_id, access_token, refresh_token, expires_at, name as account_name, email as account_email')
      .eq('auth_user_id', authUser.user.id)
      .eq('is_primary', true)
      .single();
    
    if (tokenError || !primaryToken) {
      return NextResponse.json({ 
        success: false, 
        error: 'No primary account found for user' 
      }, { status: 404 });
    }
    
    // Return the session data that should be available
    return NextResponse.json({
      success: true,
      sessionData: {
        authUserId: authUser.user.id,
        activeAccountId: primaryToken.account_id,
        accountName: primaryToken.name || primaryToken.account_name,
        accountEmail: primaryToken.email || primaryToken.account_email,
        hasAccessToken: !!primaryToken.access_token,
        hasRefreshToken: !!primaryToken.refresh_token,
        tokenExpiresAt: primaryToken.expires_at
      }
    });
  } catch (error) {
    console.error('Session refresh endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}