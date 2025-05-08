import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { google } from 'googleapis';
import { authOptions } from '../../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

// التحقق من حالة الاتصال بيوتيوب بدون استهلاك حصة API كبيرة
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ 
        success: false, 
        message: 'Not authenticated' 
      }, { status: 401 });
    }
    
    // محاولة الحصول على رمز وصول صالح
    const accessToken = await getValidAccessToken(session.user.email);
    
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        message: 'Invalid access token',
        status: 'expired'
      }, { status: 401 });
    }
    
    // إنشاء OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    // التحقق من الاتصال باستخدام طلب بسيط
    // نختار طلبًا خفيفًا لا يستهلك الكثير من الحصة
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    console.log('Fetching channel data...');
    
    const channelResponse = await youtube.channels.list({
      part: 'snippet,statistics,contentDetails',
      mine: true,
      maxResults: 1
    });
    
    console.log('Channel API response received');
    
    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      console.log('No channel found in response');
      return NextResponse.json({
        success: false,
        message: 'Channel not found',
        status: 'error'
      }, { status: 404 });
    }
    
    const channel = channelResponse.data.items[0];
    console.log('Channel data:', JSON.stringify(channel, null, 2));
    
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
    
    console.log('Parsed stats:', {
      videoCount,
      subscriberCount,
      viewCount,
      statsHidden,
      uploadsPlaylistId
    });
    
    // Try to get video count from uploads playlist if it's zero from channel statistics
    let enhancedVideoCount = videoCount;
    if (videoCount === 0 && uploadsPlaylistId) {
      try {
        console.log('Attempting to fetch video count from uploads playlist');
        const playlistResponse = await youtube.playlistItems.list({
          part: 'id',
          playlistId: uploadsPlaylistId,
          maxResults: 1
        });
        
        // Get total results if available
        if (playlistResponse.data.pageInfo?.totalResults) {
          enhancedVideoCount = playlistResponse.data.pageInfo.totalResults;
          console.log('Got video count from playlist:', enhancedVideoCount);
        }
      } catch (playlistError) {
        console.error('Error fetching video count from playlist:', playlistError);
        // Continue with original video count if this fails
      }
    }
    
    // إذا نجح الطلب، فهذا يعني أن الاتصال صالح
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
    
    // التحقق مما إذا كانت المشكلة متعلقة بالمصادقة
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