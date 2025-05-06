import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { Readable } from 'stream';

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
      // Convert the file content to a readable stream for the YouTube API
      const mediaStream = bufferToStream(fileContent);
      
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