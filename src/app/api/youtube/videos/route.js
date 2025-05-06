import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/options';

// Get user's YouTube videos
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Initialize the OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    });

    // Initialize YouTube API
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    // Fetch the user's channel ID first
    const channelResponse = await youtube.channels.list({
      part: 'id',
      mine: true,
    });
    
    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      return NextResponse.json({ error: 'YouTube channel not found' }, { status: 404 });
    }
    
    const channelId = channelResponse.data.items[0].id;
    
    // Now fetch the videos from this channel
    const videosResponse = await youtube.search.list({
      part: 'snippet',
      channelId: channelId,
      maxResults: 20,
      order: 'date',
      type: 'video'
    });
    
    if (!videosResponse.data.items) {
      return NextResponse.json({ videos: [] });
    }
    
    // Get detailed information for each video
    const videoIds = videosResponse.data.items.map(item => item.id.videoId).join(',');
    const videoDetailsResponse = await youtube.videos.list({
      part: 'snippet,statistics,status',
      id: videoIds
    });
    
    const videos = videoDetailsResponse.data.items.map(video => ({
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      thumbnailUrl: video.snippet.thumbnails.medium.url,
      publishedAt: video.snippet.publishedAt,
      viewCount: video.statistics.viewCount,
      likeCount: video.statistics.likeCount,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      status: video.status.privacyStatus
    }));
    
    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch YouTube videos', details: error.message },
      { status: 500 }
    );
  }
} 