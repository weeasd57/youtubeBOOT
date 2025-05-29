import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { Readable } from 'stream';
import { getValidAccessToken } from '@/utils/refreshToken';
import { supabaseAdmin } from '@/utils/supabase';

// Helper function to convert ArrayBuffer to Stream
function bufferToStream(buffer) {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

// Helper function to log uploads to Supabase
async function logUpload(uploadData) {
  try {
    // Get the origin from the request headers or use a default URL for the server
    const origin = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    await fetch(`${origin}/api/upload-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(uploadData),
    });
  } catch (error) {
    console.error('Failed to log upload:', error);
    // Continue even if logging fails
  }
}

// Helper function to check if a video has already been uploaded
async function isVideoAlreadyUploaded(fileId) {
  try {
    // Check upload_logs table for successful uploads with this file_id
    const { data, error } = await supabaseAdmin
      .from('upload_logs')
      .select('id')
      .eq('file_id', fileId)
      .eq('status', 'success')
      .limit(1);
      
    if (error) {
      console.error('Error checking upload logs:', error);
      return false; // If we can't check, assume it hasn't been uploaded
    }
    
    // If we found any records, the video has already been uploaded
    return data && data.length > 0;
  } catch (error) {
    console.error('Error in isVideoAlreadyUploaded:', error);
    return false; // If we can't check, assume it hasn't been uploaded
  }
}

// This endpoint processes multiple videos from Google Drive and uploads them to YouTube
// Use this with console.cron-job.org for frequent processing of more than 10 videos per day
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.authUserId || !session.activeAccountId) {
      return NextResponse.json({ error: 'Not authenticated or active account not set' }, { status: 401 });
    }

    const authUserId = session.authUserId;
    const activeAccountId = session.activeAccountId;
    
    // Try to get a valid access token, refreshing if necessary
    const accessToken = await getValidAccessToken(authUserId, activeAccountId);
    
    if (!accessToken) {
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
    
    // Get videos uploaded in the last 24 hours to process more videos at once
    // This allows for more than 10 videos per day
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    
    // You can optionally add a max limit parameter to control the number
    const maxUploads = 50; // Increase this number to process more videos
    
    const response = await drive.files.list({
      q: `mimeType contains 'video/mp4' and createdTime > '${oneDayAgo.toISOString()}'`,
      fields: 'files(id, name, mimeType)',
      orderBy: 'createdTime desc',
      pageSize: maxUploads // Control how many videos to fetch
    });

    const newFiles = response.data.files || [];
    
    if (newFiles.length === 0) {
      return NextResponse.json({ message: 'No videos found to process' });
    }

    console.log(`Found ${newFiles.length} videos to process`);
    
    // Initialize YouTube API
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    // Upload each video
    const uploadResults = [];
    const skippedFiles = [];
    
    for (const file of newFiles) {
      try {
        // Check if this video has already been uploaded
        const alreadyUploaded = await isVideoAlreadyUploaded(file.id);
        
        if (alreadyUploaded) {
          console.log(`Skipping already uploaded file: ${file.name} (${file.id})`);
          skippedFiles.push({
            fileId: file.id,
            fileName: file.name,
            status: 'skipped',
            reason: 'Already uploaded'
          });
          continue; // Skip to the next file
        }
        
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
        
        // Upload the video to YouTube with increased timeout
        const uploadResponse = await youtube.videos.insert({
          part: 'snippet,status',
          requestBody: videoResource,
          media: {
            body: mediaStream,
          },
          timeout: 10800000, // 3 hour timeout (same as in upload/route.js)
        });

        const videoId = uploadResponse.data.id;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        // Log successful upload to Supabase
        await logUpload({
          video_id: videoId,
          file_id: file.id,
          file_name: file.name,
          youtube_url: videoUrl,
          title: formattedTitle,
          status: 'success',
          user_email: session.user.email
        });

        uploadResults.push({
          fileId: file.id,
          fileName: file.name,
          videoId: videoId,
          videoUrl: videoUrl,
          status: 'success',
        });
        
        // Add some delay between uploads to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
        
      } catch (error) {
        console.error(`Error uploading file ${file.id}:`, error);
        
        // Log failed upload to Supabase
        await logUpload({
          file_id: file.id,
          file_name: file.name,
          title: `${file.name} #Shorts`,
          status: 'error',
          error_message: error.message,
        });
        
        uploadResults.push({
          fileId: file.id,
          fileName: file.name,
          status: 'error',
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      message: `Processed ${uploadResults.length} videos, skipped ${skippedFiles.length} already uploaded videos`,
      results: uploadResults,
      skipped: skippedFiles,
    });
  } catch (error) {
    console.error('Error in bulk upload process:', error);
    return NextResponse.json(
      { error: 'Failed to process bulk upload', details: error.message },
      { status: 500 }
    );
  }
}