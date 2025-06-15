import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { Readable } from 'stream';
import { getValidAccessToken } from '@/utils/refreshToken';

// Helper function to convert ArrayBuffer to Stream
function bufferToStream(buffer) {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

// This endpoint checks for new videos in Google Drive and uploads them to YouTube
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
    
    // Try to get a valid access token, refreshing if necessary
        const result = await getValidAccessToken(authUserId, activeAccountId);
    const accessToken = result?.accessToken;
    const tokenError = result?.error;
    
    if (!result || tokenError || !accessToken) {
      console.error("Failed to get valid access token");
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
    }

    // Initialize the OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    // Initialize Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Get videos uploaded in the last 5 minutes
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
    
    const response = await drive.files.list({
      q: `mimeType contains 'video/mp4' and createdTime > '${fiveMinutesAgo.toISOString()}'`,
      fields: 'files(id, name, mimeType)',
      orderBy: 'createdTime desc'
    });

    const newFiles = response.data.files || [];
    
    if (newFiles.length === 0) {
      return NextResponse.json({ message: 'No new videos found' });
    }

    // Initialize YouTube API
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    // Upload each new video
    const uploadResults = [];
    
    for (const file of newFiles) {
      try {
        // Get the file content
        const fileResponse = await drive.files.get({
          fileId: file.id,
          alt: 'media',
          acknowledgeAbuse: true,
        }, { responseType: 'arraybuffer' });

        const fileContent = fileResponse.data;
        
        // Format title to include #Shorts
        const formattedTitle = `${file.name} #Shorts`;
        
        // Create the video resource
        const videoResource = {
          snippet: {
            title: formattedTitle,
            description: 'Auto-uploaded from Google Drive',
            categoryId: '22', // People & Blogs category
          },
          status: {
            privacyStatus: 'public',
            selfDeclaredMadeForKids: false,
          },
        };
        
        // Convert file content to a readable stream
        const mediaStream = bufferToStream(fileContent);
        
        // Upload the video to YouTube
        const uploadResponse = await youtube.videos.insert({
          part: 'snippet,status',
          requestBody: videoResource,
          media: {
            body: mediaStream,
          },
        });

        uploadResults.push({
          fileId: file.id,
          fileName: file.name,
          videoId: uploadResponse.data.id,
          videoUrl: `https://www.youtube.com/watch?v=${uploadResponse.data.id}`,
          status: 'success',
        });
      } catch (error) {
        console.error(`Error uploading file ${file.id}:`, error);
        uploadResults.push({
          fileId: file.id,
          fileName: file.name,
          status: 'error',
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      message: `Processed ${newFiles.length} new videos`,
      results: uploadResults,
    });
  } catch (error) {
    console.error('Error in auto-upload process:', error);
    return NextResponse.json(
      { error: 'Failed to process auto-upload', details: error.message },
      { status: 500 }
    );
  }
}