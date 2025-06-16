import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { Readable } from 'stream';
import { EventEmitter } from 'events';
import { getValidAccessToken } from '@/utils/refreshToken';
import { supabaseAdmin } from '@/utils/supabase';
import { processVideoTitle } from '@/utils/titleHelpers';

// Global events emitter to track uploads in progress
const uploadEvents = new EventEmitter();
// Map to store upload progress by file ID
const uploadProgressMap = new Map();

// Helper function to convert ArrayBuffer to Stream with progress tracking
function bufferToStream(buffer, fileId) {
  const totalBytes = buffer.byteLength;
  let bytesRead = 0;
  
  const readable = new Readable({
    read(size) {
      // If we've consumed all the data, push null to signal end
      if (bytesRead >= totalBytes) {
        this.push(null);
        return;
      }
      
      // Calculate how many bytes to read this time
      const chunkSize = Math.min(size, totalBytes - bytesRead);
      const chunk = buffer.slice(bytesRead, bytesRead + chunkSize);
      
      // Update bytes read
      bytesRead += chunkSize;
      
      // Calculate and emit progress
      const progress = Math.round((bytesRead / totalBytes) * 100);
      uploadProgressMap.set(fileId, progress);
      uploadEvents.emit('progress', { fileId, progress });
      
      // Push the chunk
      this.push(Buffer.from(chunk));
    }
  });
  
  return readable;
}

// Helper function to log uploads to Supabase
async function logUpload(uploadData) {
  try {
    const { data, error } = await supabaseAdmin
      .from('upload_logs')
      .insert({
        ...uploadData,
        created_at: new Date().toISOString()
      });
      
    if (error) {
      console.error('Error logging upload:', error);
    }
    
    return data;
  } catch (e) {
    console.error('Failed to log upload:', e);
    // Non-critical error, don't throw
    return null;
  }
}

// Endpoint to get upload progress by fileId
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');
  
  if (!fileId) {
    return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
  }
  
  const progress = uploadProgressMap.get(fileId) || 0;
  return NextResponse.json({ fileId, progress });
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.auth_user_id || !session.active_account_id) {
      console.log('Session missing required fields:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasAuthUserId: !!session?.user?.auth_user_id,
        hasActiveAccountId: !!session?.active_account_id
      });
      return NextResponse.json({ error: 'Not authenticated or active account not set' }, { status: 401 });
    }

    const authUserId = session.user.auth_user_id;
    const activeAccountId = session.active_account_id;
    const { fileId, title, description } = await request.json();
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    console.log(`Upload: Processing for Auth User ID: ${authUserId}, Account ID: ${activeAccountId}`);

    // Get valid access token, refreshing if necessary
    const accessToken = await getValidAccessToken(authUserId, activeAccountId);
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
    }

    // Initialize the OAuth2 client with fresh token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    // Initialize Drive API to get the file
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Get file details first
    const fileDetails = await drive.files.get({
      fileId,
      fields: 'id,name',
    });
    
    const fileName = fileDetails.data.name;
    
    // Get the file content from Drive
    const fileResponse = await drive.files.get({
      fileId,
      alt: 'media',
      acknowledgeAbuse: true,
    }, { responseType: 'arraybuffer' });

    const fileContent = fileResponse.data;
    
    // Initialize YouTube API with the same fresh token
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    // استخدام دالة معالجة العنوان لتأكد من أن العنوان لا يتجاوز 100 حرف وأخذ أول 4 كلمات إذا كان طويلاً
    const formattedTitle = processVideoTitle(title);
    
    // Create the video resource
    const videoResource = {
      snippet: {
        title: formattedTitle,
        description: description || 'Uploaded from Google Drive',
        categoryId: '22', // People & Blogs category
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    };
    
    // Reset the progress tracking for this file
    uploadProgressMap.set(fileId, 0);
    
    // Convert the file content to a readable stream with progress tracking
    const mediaStream = bufferToStream(fileContent, fileId);
    
    // Upload the video to YouTube
    const uploadResponse = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: videoResource,
      media: {
        body: mediaStream,
      },
    });
    
    const videoId = uploadResponse.data.id;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Update the progress map to indicate completion
    uploadProgressMap.set(fileId, 100);
    
    // Log successful upload to Supabase
    await logUpload({
      video_id: videoId,
      file_id: fileId,
      file_name: fileName,
      youtube_url: videoUrl,
      title: formattedTitle,
      status: 'success',
    });

    return NextResponse.json({
      success: true,
      videoId,
      videoUrl,
      title: formattedTitle
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    
    // Log failed upload to Supabase
    await logUpload({
      file_id: fileId,
      file_name: fileName,
      title: formattedTitle,
      status: 'error',
      error_message: error.message || 'Unknown error',
    });
    
    return NextResponse.json(
      { 
        error: 'Error uploading video to YouTube',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}