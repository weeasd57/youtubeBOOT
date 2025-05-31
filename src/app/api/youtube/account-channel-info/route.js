import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase-server';
import { google } from 'googleapis';
import { getValidAccessToken } from '@/utils/refreshToken';

// Create a new API endpoint to get YouTube channel info for a specific account
export async function GET(request) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    
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
    
    console.log(`Fetching account info for accountId: ${accountId}`);
    
    // Get account from Supabase using the actual schema
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('id, email, owner_id, name, account_type, image')
      .eq('id', accountId)
      .single();
    
    if (accountError) {
      console.error('Error getting account:', accountError);
      return NextResponse.json(
        { error: 'Not Found', message: 'Account not found', details: accountError }, 
        { status: 404 }
      );
    }
    
    if (!account) {
      console.error('Account not found, no error returned');
      return NextResponse.json(
        { error: 'Not Found', message: 'Account not found, no data returned' }, 
        { status: 404 }
      );
    }
    
    // Check if the account belongs to the logged-in user
    if (account.owner_id !== session.authUserId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this account' }, 
        { status: 403 }
      );
    }
    
    try {
      // Get token for this specific account's email (bypassing getValidAccessToken)
      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from('user_tokens')
        .select('access_token, refresh_token, expires_at')
        .eq('user_email', account.email)
        .single();
      
      console.log(`Looking for tokens with email: ${account.email}`);
      
      let accessToken;
      
      if (tokenError || !tokenData || !tokenData.access_token) {
        console.log('No token found for account email, using getValidAccessToken as fallback');
        // Fall back to getValidAccessToken if no direct token found
        accessToken = await getValidAccessToken(session.authUserId, accountId);
      } else {
        console.log('Found token for account email');
        
        // Check if token is expired
        const expiryTime = new Date(tokenData.expires_at * 1000);
        const safeExpiryTime = new Date(expiryTime.getTime() - 5 * 60 * 1000);
        
        if (safeExpiryTime > new Date()) {
          console.log('Token is still valid');
          accessToken = tokenData.access_token;
        } else {
          console.log('Token is expired, refreshing');
          // Token expired, refresh it
          // Initialize OAuth2 client
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
          );
          
          // Set the refresh token
          oauth2Client.setCredentials({
            refresh_token: tokenData.refresh_token,
          });
          
          try {
            // Refresh the token
            const { credentials } = await oauth2Client.refreshAccessToken();
            
            console.log('Token refreshed successfully');
            
            accessToken = credentials.access_token;
            const refreshToken = credentials.refresh_token || tokenData.refresh_token;
            const expiresAt = Math.floor(Date.now() / 1000 + credentials.expires_in);
            
            // Update token in database
            await supabaseAdmin
              .from('user_tokens')
              .update({
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_at: expiresAt,
                updated_at: new Date().toISOString()
              })
              .eq('user_email', account.email);
          } catch (refreshError) {
            console.error('Error refreshing token:', refreshError);
            // Fall back to getValidAccessToken
            accessToken = await getValidAccessToken(session.authUserId, accountId);
          }
        }
      }
      
      if (!accessToken) {
        return NextResponse.json({
          success: false,
          status: 'disconnected',
          message: 'No valid access token available. Please reconnect your YouTube account.',
          channelInfo: null
        });
      }

      // Initialize YouTube API with token
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: accessToken
      });
      
      const youtube = google.youtube({
        version: 'v3',
        auth: oauth2Client
      });
      
      // Get channel info
      const response = await youtube.channels.list({
        part: 'snippet,statistics,contentDetails',
        mine: true,
        maxResults: 1
      });
      
      if (!response.data.items || response.data.items.length === 0) {
        return NextResponse.json({ 
          success: false, 
          status: 'error',
          message: 'No YouTube channel found for this account',
          channelInfo: null
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
      
      return NextResponse.json({
        success: true,
        status: 'connected',
        channelInfo
      });
    } catch (error) {
      console.error('Error fetching YouTube channel info:', error);
      
      // Check if it's a suspension error
      const errorResponse = error.response?.data?.error;
      if (errorResponse?.code === 403 && errorResponse?.message?.includes('suspended')) {
        return NextResponse.json({ 
          success: false, 
          status: 'suspended',
          message: 'YouTube account is suspended',
          channelInfo: null
        });
      }
      
      return NextResponse.json({ 
        success: false, 
        status: 'error',
        message: 'Error fetching YouTube channel info: ' + (error.message || 'Unknown error'),
        channelInfo: null
      });
    }
  } catch (error) {
    console.error('Unexpected error in account-channel-info API:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'An unexpected error occurred' }, 
      { status: 500 }
    );
  }
} 