import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { Readable } from 'stream';
import { EventEmitter } from 'events';

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
    
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { fileId, title, description } = await request.json();
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Initialize the OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: session.accessToken,
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
    
    // Initialize YouTube API
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    // Format title to include #Shorts if not already present
    const formattedTitle = title.includes('#Shorts') ? title : `${title} #Shorts`;
    
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
    
    try {
      // Initialize progress tracking for this file
      uploadProgressMap.set(fileId, 0);
      
      // Convert the file content to a readable stream for the YouTube API with progress tracking
      const mediaStream = bufferToStream(fileContent, fileId);
      
      // Upload the video to YouTube with timeout increased (10 hour issue fix)
      const uploadResponse = await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: videoResource,
        media: {
          body: mediaStream,
        },
        // Set a longer timeout (3 hours in milliseconds)
        timeout: 10800000,
      });

      const videoId = uploadResponse.data.id;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      
      // Clear the progress tracking for this file
      uploadProgressMap.delete(fileId);
      
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
      });
    } catch (uploadError) {
      // Clear the progress tracking for this file
      uploadProgressMap.delete(fileId);
      
      // Log failed upload to Supabase
      await logUpload({
        file_id: fileId,
        file_name: fileName,
        title: formattedTitle,
        status: 'error',
        error_message: uploadError.message,
      });
      
      throw uploadError;
    }
  } catch (error) {
    console.error('Error uploading to YouTube:', error);
    return NextResponse.json(
      { error: 'Failed to upload video to YouTube', details: error.message },
      { status: 500 }
    );
  }
}