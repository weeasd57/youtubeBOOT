import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { google } from 'googleapis';
import { authOptions } from '../../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

// Check YouTube connection status without consuming large API quota
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    console.log('Fetching account info for accountId:', accountId);
    const tokenResponse = await getValidAccessToken(accountId);
    
    if (!tokenResponse || !tokenResponse.success || !tokenResponse.accessToken) {
      console.error('Failed to get valid access token for account:', accountId);
      return NextResponse.json({ 
        error: tokenResponse?.error || 'Invalid or expired credentials' 
      }, { status: 401 });
    }

    const accessToken = tokenResponse.accessToken;

    // Validate token format
    if (typeof accessToken !== 'string' || !accessToken.startsWith('ya29.')) {
      console.error('Invalid access token format:', 
        typeof accessToken === 'string' ? accessToken.substring(0, 10) : typeof accessToken);
      return NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

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
    
    // Initialize with API values - no static numbers
    let enhancedVideoCount = videoCount;
    let enhancedSubscriberCount = subscriberCount;
    let enhancedViewCount = viewCount;
    
    // Try to get actual data from different API endpoints if primary stats are hidden
    if (uploadsPlaylistId) {
      try {
        console.log('Fetching accurate data from uploads playlist...');
        
        // Get full playlist details to get accurate video count
        const playlistResponse = await youtube.playlistItems.list({
          part: 'id,snippet,contentDetails',
          playlistId: uploadsPlaylistId,
          maxResults: 50  // Get up to 50 videos to get a better count
        });
        
        // Get actual video count from playlist
        if (playlistResponse.data.pageInfo?.totalResults) {
          console.log(`Found ${playlistResponse.data.pageInfo.totalResults} videos in uploads playlist`);
          enhancedVideoCount = playlistResponse.data.pageInfo.totalResults;
        }
        
        // Get video IDs to fetch more detailed statistics
        if (playlistResponse.data.items?.length > 0) {
          try {
            const videoIds = playlistResponse.data.items
              .filter(item => item.contentDetails?.videoId)
              .map(item => item.contentDetails.videoId);
            
            if (videoIds.length > 0) {
              // Fetch detailed video statistics
              const videoResponse = await youtube.videos.list({
                part: 'statistics',
                id: videoIds.join(',').substring(0, 50) // API limit for IDs
              });
              
              // Calculate total views from all videos if API returns 0
              if (videoResponse.data.items?.length > 0 && enhancedViewCount === 0) {
                const totalViews = videoResponse.data.items.reduce((sum, video) => {
                  return sum + parseInt(video.statistics.viewCount || '0', 10);
                }, 0);
                
                console.log(`Calculated ${totalViews} total views from videos`);
                if (totalViews > 0) {
                  enhancedViewCount = totalViews;
                }
              }
            }
          } catch (videoError) {
            console.error('Error fetching video statistics:', videoError.message);
          }
        }
      } catch (playlistError) {
        console.error('Error fetching uploads playlist:', playlistError.message);
      }
    }

    // Try to fetch subscriber data with a different endpoint if needed
    if (enhancedSubscriberCount === 0 || statsHidden) {
      try {
        // Alternative API endpoint that might return subscriber data
        const channelDetailResponse = await youtube.channels.list({
          part: 'brandingSettings,statistics',
          id: channelId
        });

        if (channelDetailResponse.data.items?.length > 0) {
          const channelDetails = channelDetailResponse.data.items[0];
          
          // Try to get subscriber count from alternative source
          if (channelDetails.statistics?.subscriberCount) {
            const altSubscriberCount = parseInt(channelDetails.statistics.subscriberCount, 10);
            if (altSubscriberCount > 0) {
              enhancedSubscriberCount = altSubscriberCount;
            }
          }
        }
      } catch (detailError) {
        console.error('Error fetching additional channel details:', detailError.message);
      }
    }
    
    // Return connection status and channel info with the best available data
    return NextResponse.json({
      success: true,
      status: 'connected',
      channelId,
      channelTitle,
      videoCount: enhancedVideoCount,
      subscriberCount: enhancedSubscriberCount,
      viewCount: enhancedViewCount,
      originalVideoCount: videoCount,
      originalSubscriberCount: subscriberCount,
      originalViewCount: viewCount,
      statsHidden,
      uploadsPlaylistId,
      thumbnailUrl: channel.snippet.thumbnails?.default?.url || 
                   channel.snippet.thumbnails?.medium?.url || 
                   channel.snippet.thumbnails?.high?.url || null
    });
  } catch (error) {
    console.error('Error checking YouTube connection:', error);
    
    // Check for YouTube account suspension error
    if (error.message?.includes('is suspended') || 
        error.message?.includes('account of the authenticated user is suspended')) {
      return NextResponse.json({
        success: false,
        message: 'YouTube account suspended',
        error: 'The YouTube account of the authenticated user is suspended.',
        status: 'suspended'
      }, { status: 403 });
    }
    
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