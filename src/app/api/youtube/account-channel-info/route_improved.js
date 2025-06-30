import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase-server';
import { google } from 'googleapis';
import { getValidAccessToken } from '@/utils/refreshToken';

// Create a new API endpoint to get YouTube channel info for a specific account
export async function GET(request) {
  const startTime = Date.now();
  const timing = {};
  
  try {
    // Get session
    timing.sessionStart = Date.now();
    const session = await getServerSession(authOptions);
    timing.sessionEnd = Date.now();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to access this endpoint' }, 
        { status: 401 }
      );
    }
    
    // Get accountId from query params
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    
    if (!accountId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'accountId parameter is required' }, 
        { status: 400 }
      );
    }
    
    // Get account from Supabase
    timing.supabaseStart = Date.now();
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('id, email, owner_id, name, account_type, image')
      .eq('id', accountId)
      .maybeSingle();
    timing.supabaseEnd = Date.now();
      
    if (accountError) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Account not found', details: accountError, timing }, 
        { status: 404 }
      );
    }
    
    if (!account) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Account not found, no data returned', timing }, 
        { status: 404 }
      );
    }
    
    // Check if the account belongs to the logged-in user
    if (account.owner_id !== session.user?.auth_user_id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this account', timing }, 
        { status: 403 }
      );
    }
    
    try {
      timing.tokenStart = Date.now();
      const tokenResponse = await getValidAccessToken(session.user.auth_user_id, accountId);
      timing.tokenEnd = Date.now();
      
      if (!tokenResponse || !tokenResponse.success || !tokenResponse.accessToken) {
        // Check if this is a reauthentication required error
        if (tokenResponse?.error?.includes('re-authenticate') || 
            tokenResponse?.error?.includes('invalid_grant') ||
            tokenResponse?.error?.includes('refresh token') ||
            tokenResponse?.error?.includes('Refresh token not available')) {
          return NextResponse.json({ 
            success: false,
            status: 'reauthenticate_required',
            message: 'Account needs to be reconnected. Please use the reconnect button.',
            error: tokenResponse?.error || 'Authentication required',
            timing
          });
        }
        
        return NextResponse.json({ 
          success: false,
          status: 'error',
          error: tokenResponse?.error || 'Invalid or expired credentials', 
          timing
        }, { status: 401 });
      }

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: tokenResponse.accessToken });
      
      const youtube = google.youtube({
        version: 'v3',
        auth: oauth2Client
      });
      
      // Get channel info
      timing.youtubeApiStart = Date.now();
      const response = await youtube.channels.list({
        part: 'snippet,statistics,contentDetails',
        mine: true,
        maxResults: 1
      });
      timing.youtubeApiEnd = Date.now();
      
      if (!response.data.items || response.data.items.length === 0) {
        return NextResponse.json({ 
          success: false, 
          status: 'error',
          message: 'No YouTube channel found for this account',
          channelInfo: null,
          timing
        });
      }
      
      const channel = response.data.items[0];
      const channelInfo = {
        channelId: channel.id,
        channelTitle: channel.snippet.title,
        customUrl: channel.snippet.customUrl,
        thumbnailUrl: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url,
        viewCount: channel.statistics.viewCount,
        subscriberCount: channel.statistics.subscriberCount,
        videoCount: channel.statistics.videoCount,
        statsHidden: channel.statistics.hiddenSubscriberCount || false,
        uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads,
        lastUpdated: new Date().toISOString()
      };
      
      timing.total = Date.now() - startTime;
      
      return NextResponse.json({
        success: true,
        status: 'connected',
        channelInfo,
        timing
      });
    } catch (error) {
      timing.errorTime = Date.now();
      timing.total = Date.now() - startTime;
      console.error('Error fetching YouTube channel info:', error);
      
      // Check if it's an authentication error
      if (error.response?.status === 401 || 
          error.message?.includes('invalid_grant') ||
          error.message?.includes('unauthorized')) {
        return NextResponse.json({ 
          success: false, 
          status: 'reauthenticate_required',
          message: 'Account authentication has expired. Please reconnect your account.',
          channelInfo: null,
          timing
        });
      }
      
      // Check if it's a suspension error
      const errorResponse = error.response?.data?.error;
      if (errorResponse?.code === 403 && errorResponse?.message?.includes('suspended')) {
        return NextResponse.json({ 
          success: false, 
          status: 'suspended',
          message: 'YouTube account is suspended',
          channelInfo: null,
          timing
        });
      }
      
      return NextResponse.json({ 
        success: false, 
        status: 'error',
        message: 'Error fetching YouTube channel info: ' + (error.message || 'Unknown error'),
        channelInfo: null,
        timing
      });
    }
  } catch (error) {
    timing.errorTime = Date.now();
    timing.total = Date.now() - startTime;
    console.error('Unexpected error in account-channel-info API:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'An unexpected error occurred', timing }, 
      { status: 500 }
    );
  }
}