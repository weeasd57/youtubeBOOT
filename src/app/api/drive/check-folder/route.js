import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

// API endpoint to check if a folder exists in Google Drive
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get folder ID from query parameters
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');
    
    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
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
      // Try to get the folder metadata - if it fails, the folder doesn't exist
      const response = await drive.files.get({
        fileId: folderId,
        fields: 'id,name,mimeType'
      });
      
      const file = response.data;
      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
      
      return NextResponse.json({ 
        exists: true, 
        isFolder: isFolder,
        name: file.name,
        id: file.id
      });
    } catch (error) {
      // If the error is a 404, the folder doesn't exist
      if (error.code === 404 || (error.response && error.response.status === 404)) {
        return NextResponse.json({ exists: false });
      }
      
      // Other errors should be reported
      console.error('Error checking folder:', error);
      return NextResponse.json({ 
        error: 'Failed to check folder',
        details: error.message,
        exists: false 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in check-folder API:', error);
    return NextResponse.json({ 
      error: 'Failed to check folder existence',
      details: error.message,
      exists: false
    }, { status: 500 });
  }
} 