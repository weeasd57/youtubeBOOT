import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { google } from 'googleapis';
import { authOptions } from '../../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

// Check YouTube connection status without consuming large API quota
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ 
        success: false, 
        message: 'Not authenticated' 
      }, { status: 401 });
    }
    
    // Get valid access token
    const accessToken = await getValidAccessToken(session.user.email);
    
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        message: 'Invalid access token',
        status: 'expired'
      }, { status: 401 });
    }
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    // Check connection with a lightweight request
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    const channelResponse = await youtube.channels.list({
      part: 'snippet,statistics,contentDetails',
      mine: true,
      maxResults: 1
    });
    
    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Channel not found',
        status: 'error'
      }, { status: 404 });
    }
    
    const channel = channelResponse.data.items[0];
    
    // Extract and parse statistics as numbers
    const channelId = channel.id;
    const channelTitle = channel.snippet.title;
    
    // Parse statistics, ensuring they are numbers
    const videoCount = parseInt(channel.statistics.videoCount || '0', 10);
    const subscriberCount = parseInt(channel.statistics.subscriberCount || '0', 10);
    const viewCount = parseInt(channel.statistics.viewCount || '0', 10);
    
    // Check if statistics are hidden (could be set to private)
    const statsHidden = channel.statistics.hiddenSubscriberCount === true;
    
    // Get uploads playlist ID
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads || null;
    
    // Try to get video count from uploads playlist if it's zero from channel statistics
    let enhancedVideoCount = videoCount;
    if (videoCount === 0 && uploadsPlaylistId) {
      try {
        const playlistResponse = await youtube.playlistItems.list({
          part: 'id',
          playlistId: uploadsPlaylistId,
          maxResults: 1
        });
        
        // Get total results if available
        if (playlistResponse.data.pageInfo?.totalResults) {
          enhancedVideoCount = playlistResponse.data.pageInfo.totalResults;
        }
      } catch (playlistError) {
        // Continue with original video count if this fails
      }
    }
    
    // Return connection status and channel info
    return NextResponse.json({
      success: true,
      status: 'connected',
      channelId,
      channelTitle,
      videoCount: enhancedVideoCount,
      originalVideoCount: videoCount,
      subscriberCount,
      viewCount,
      statsHidden,
      uploadsPlaylistId,
      thumbnailUrl: channel.snippet.thumbnails?.default?.url || 
                   channel.snippet.thumbnails?.medium?.url || 
                   channel.snippet.thumbnails?.high?.url || null
    });
  } catch (error) {
    console.error('Error checking YouTube connection:', error);
    
    // Check if the issue is authentication-related
    if (error.code === 401 || error.message?.includes('invalid_grant') || error.message?.includes('Invalid Credentials')) {
      return NextResponse.json({
        success: false,
        message: 'Authentication failed',
        status: 'expired'
      }, { status: 401 });
    }
    
    return NextResponse.json({
      success: false,
      message: 'Error checking connection',
      error: error.message || 'Unknown error',
      errorDetails: JSON.stringify(error),
      status: 'error'
    }, { status: 500 });
  }
} 