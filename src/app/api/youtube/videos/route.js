import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/options';
import { withRetry, isQuotaError } from '@/utils/apiHelpers';
import { getValidAccessToken } from '@/utils/refreshToken';

// Wrapper for Google API calls to standardize error handling
async function safeGoogleApiCall(apiCall) {
  try {
    return await apiCall();
  } catch (error) {
    // Extract the most useful error message from Google's error structure
    const errorDetails = error.response?.data?.error || {};
    const message = errorDetails.message || error.message || 'Unknown Google API error';
    const status = error.status || error.code || error.response?.status || 500;
    
    // Enhance error with additional properties for better handling
    error.enhancedMessage = message;
    error.enhancedStatus = status;
    
    // Log detailed error for debugging
    console.error('Google API error:', {
      message,
      status,
      errors: errorDetails.errors || error.errors || [],
      code: errorDetails.code || error.code
    });
    
    throw error;
  }
}

// Get user's YouTube videos
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.auth_user_id || !session.active_account_id) {
      console.log('Session missing required fields:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasAuthUserId: !!session?.user?.auth_user_id,
        hasActiveAccountId: !!session?.active_account_id
      });
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const authUserId = session.user.auth_user_id;
    const activeAccountId = session.active_account_id;
    console.log(`YouTube videos: Fetching for Auth User ID: ${authUserId}, Account ID: ${activeAccountId}`);

    // Get a valid access token, refreshing if necessary
        const result = await getValidAccessToken(authUserId, activeAccountId);
    const accessToken = result?.accessToken;
    const tokenError = result?.error;
    
    if (!result || tokenError || !accessToken) {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
    }
    
    // Initialize the OAuth2 client with fresh token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    // Initialize YouTube API
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    // Fetch the user's channel ID first with retry logic
    const channelResponse = await withRetry(
      () => safeGoogleApiCall(() => youtube.channels.list({
        part: 'id',
        mine: true,
      })),
      {
        maxRetries: 2, // More conservative retry count
        initialDelay: 3000,
        maxDelay: 20000,
        shouldRetry: (error) => isQuotaError(error),
        onRetry: ({ error, retryCount, delay }) => {
          console.log(`Retrying channel list fetch (${retryCount}) after ${Math.round(delay/1000)}s due to: ${error.enhancedMessage || error.message}`);
        }
      }
    );
    
    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      return NextResponse.json({ error: 'YouTube channel not found' }, { status: 404 });
    }
    
    const channelId = channelResponse.data.items[0].id;
    
    // Now fetch the videos from this channel with retry logic - reduce number of results to save quota
    const videosResponse = await withRetry(
      () => safeGoogleApiCall(() => youtube.search.list({
        part: 'snippet',
        channelId: channelId,
        maxResults: 5, // Reduced from 10 to further minimize quota usage
        order: 'date',
        type: 'video'
      })),
      {
        maxRetries: 1, // Even more conservative for search which uses more quota
        initialDelay: 3000,
        maxDelay: 10000,
        shouldRetry: (error) => isQuotaError(error),
        onRetry: ({ error, retryCount, delay }) => {
          console.log(`Retrying video search (${retryCount}) after ${Math.round(delay/1000)}s due to: ${error.enhancedMessage || error.message}`);
        }
      }
    );
    
    if (!videosResponse.data.items || videosResponse.data.items.length === 0) {
      return NextResponse.json({ videos: [] });
    }
    
    // Get detailed information for each video with retry logic
    const videoIds = videosResponse.data.items.map(item => item.id.videoId).join(',');
    const videoDetailsResponse = await withRetry(
      () => safeGoogleApiCall(() => youtube.videos.list({
        part: 'snippet,statistics,status',
        id: videoIds
      })),
      {
        maxRetries: 1, // Conservative retry for video details
        initialDelay: 3000,
        maxDelay: 10000,
        shouldRetry: (error) => isQuotaError(error),
        onRetry: ({ error, retryCount, delay }) => {
          console.log(`Retrying video details fetch (${retryCount}) after ${Math.round(delay/1000)}s due to: ${error.enhancedMessage || error.message}`);
        }
      }
    );
    
    const videos = videoDetailsResponse.data.items.map(video => ({
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      thumbnailUrl: video.snippet.thumbnails.medium.url,
      publishedAt: video.snippet.publishedAt,
      viewCount: video.statistics.viewCount || '0',
      likeCount: video.statistics.likeCount || '0',
      url: `https://www.youtube.com/watch?v=${video.id}`,
      status: video.status.privacyStatus
    }));
    
    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    
    // Provide a more specific error message for quota issues
    if (isQuotaError(error)) {
      const message = 'YouTube API quota exceeded. This is a limitation imposed by YouTube and not an error with the application. Your uploads will still work, but the display of your videos may be temporarily limited.';
      
      return NextResponse.json(
        { 
          error: 'YouTube API quota exceeded',
          message: message,
          details: error.enhancedMessage || error.message,
          isQuotaError: true
        },
        { status: 429 } // Use 429 Too Many Requests status code for quota issues
      );
    }
    
    // Handle authentication errors specifically
    if (error.enhancedStatus === 401 || error.status === 401 || error.code === 401) {
      return NextResponse.json(
        { 
          error: 'Authentication error',
          message: 'Your YouTube authentication has expired. Please sign out and sign back in.',
          details: error.enhancedMessage || error.message
        },
        { status: 401 }
      );
    }
    
    // General error case
    return NextResponse.json(
      { 
        error: 'Failed to fetch YouTube videos',
        message: 'There was a problem retrieving your YouTube videos.',
        details: error.enhancedMessage || error.message
      },
      { status: error.enhancedStatus || error.status || 500 }
    );
  }
}