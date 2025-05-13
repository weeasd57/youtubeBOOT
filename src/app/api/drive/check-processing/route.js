import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { google } from 'googleapis';
import { getGoogleAuthFromToken } from '@/utils/googleAuth';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    // Get the session
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 401 }
      );
    }

    // Get URL parameters
    const url = new URL(request.url);
    const fileId = url.searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    try {
      // Get Google auth
      const auth = getGoogleAuthFromToken(session.accessToken);
      
      // Create Drive client
      const drive = google.drive({ version: 'v3', auth });

      // Get the file metadata
      const fileResponse = await drive.files.get({
        fileId: fileId,
        fields: 'id,name,mimeType,videoMediaMetadata,size,thumbnailLink,webViewLink,videoStatus'
      });

      const fileData = fileResponse.data;
      
      // Check if this is a video file
      const isVideo = fileData.mimeType && fileData.mimeType.startsWith('video/');
      
      if (!isVideo) {
        return NextResponse.json({
          isProcessing: false,
          isVideo: false,
          fileId: fileId,
          message: 'File is not a video'
        });
      }

      // Check for video processing status
      // If videoMediaMetadata exists and has width/height, video is likely processed
      const isProcessed = Boolean(
        fileData.videoMediaMetadata && 
        fileData.videoMediaMetadata.width && 
        fileData.videoMediaMetadata.height
      );

      return NextResponse.json({
        isProcessing: !isProcessed,
        isVideo: true,
        fileId: fileId,
        fileDetails: {
          name: fileData.name,
          mimeType: fileData.mimeType,
          size: fileData.size,
          thumbnailLink: fileData.thumbnailLink,
          webViewLink: fileData.webViewLink,
          videoMetadata: fileData.videoMediaMetadata || {}
        }
      });
    } catch (error) {
      // Check if this is a "File not found" error
      if (error.code === 404 || error.message?.includes('File not found')) {
        return NextResponse.json(
          { error: "File not found", fileId },
          { status: 404 }
        );
      }

      console.error('Error fetching file processing status:', error);
      return NextResponse.json(
        { error: `Error fetching file: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in check-processing endpoint:', error);
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
} 