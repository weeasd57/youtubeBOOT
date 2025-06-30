import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase-server';
import { google } from 'googleapis';

/**
 * API endpoint to initiate reconnection for a specific account
 * This generates a special OAuth URL that will refresh the account's tokens
 */
export async function POST(request) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in' }, 
        { status: 401 }
      );
    }

    const { accountId } = await request.json();
    
    if (!accountId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'accountId is required' }, 
        { status: 400 }
      );
    }

    // Verify account ownership
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('id, email, owner_id, name')
      .eq('id', accountId)
      .eq('owner_id', session.user.auth_user_id)
      .maybeSingle();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Account not found or access denied' }, 
        { status: 404 }
      );
    }

    // Generate reconnection token
    const reconnectToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store reconnection token in database
    const { error: tokenError } = await supabaseAdmin
      .from('reconnect_tokens')
      .insert({
        token: reconnectToken,
        account_id: accountId,
        user_id: session.user.auth_user_id,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

    if (tokenError) {
      console.error('Error storing reconnect token:', tokenError);
      return NextResponse.json(
        { error: 'Internal Server Error', message: 'Failed to generate reconnection token' }, 
        { status: 500 }
      );
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
    );

    // Generate OAuth URL with reconnection state
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent to get refresh token
      state: JSON.stringify({
        reconnect: true,
        token: reconnectToken,
        accountId: accountId
      })
    });

    return NextResponse.json({
      success: true,
      authUrl,
      message: 'Reconnection URL generated successfully'
    });

  } catch (error) {
    console.error('Error in reconnect API:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message }, 
      { status: 500 }
    );
  }
}