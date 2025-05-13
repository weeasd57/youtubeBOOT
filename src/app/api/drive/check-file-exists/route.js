import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get parameters from query
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');
    const videoId = searchParams.get('videoId');
    
    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    // Get a valid access token
    const accessToken = await getValidAccessToken(session.user.email);
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
    }

    // Initialize the Drive API client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    try {
      // Search for files in the specified folder that contain the videoId in their name
      const response = await drive.files.list({
        q: `'${folderId}' in parents and name contains 'tiktok-${videoId}' and trashed=false`,
        fields: 'files(id, name, mimeType, webViewLink)',
        spaces: 'drive'
      });
      
      const files = response.data.files || [];
      
      if (files.length > 0) {
        // File exists
        return NextResponse.json({ 
          exists: true, 
          fileId: files[0].id,
          fileName: files[0].name,
          webViewLink: files[0].webViewLink
        });
      } else {
        // File doesn't exist
        return NextResponse.json({ exists: false });
      }
    } catch (error) {
      console.error('Error checking file existence:', error);
      return NextResponse.json({ 
        error: 'Failed to check file existence',
        details: error.message,
        exists: false 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in check-file-exists API:', error);
    return NextResponse.json({ 
      error: 'Failed to check file existence',
      details: error.message,
      exists: false
    }, { status: 500 });
  }
} 