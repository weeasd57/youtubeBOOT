import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

// Debug endpoint to list all folders and their properties
export async function GET(req) {
  try {
    console.log('Drive debug endpoint called');
    
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated or active account not set' }, { status: 401 });
    }

    if (!session.user?.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 401 });
    }
    
    try {
      // Get a valid access token, refreshing if necessary
      const accessToken = await getValidAccessToken(authUserId, activeAccountId);
      
      if (!accessToken) {
        return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
      }
      
      // Initialize the Drive API client
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      // Query for ALL items to see what's actually in the drive
      const allFilesResponse = await drive.files.list({
        fields: 'files(id, name, mimeType, parents, createdTime)',
        pageSize: 100
      });
      
      // Query specifically for folders
      const foldersResponse = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name, mimeType, parents, createdTime)',
        pageSize: 100,
        orderBy: 'createdTime desc'
      });
      
      // Count mime types to see what's in the drive
      const mimeTypes = {};
      if (allFilesResponse.data.files) {
        allFilesResponse.data.files.forEach(file => {
          if (file.mimeType) {
            mimeTypes[file.mimeType] = (mimeTypes[file.mimeType] || 0) + 1;
          }
        });
      }
      
      return NextResponse.json({
        allFiles: allFilesResponse.data.files || [],
        folders: foldersResponse.data.files || [],
        mimeTypeCounts: mimeTypes,
        foldersCount: foldersResponse.data.files?.length || 0,
        totalFiles: allFilesResponse.data.files?.length || 0
      });
    } catch (error) {
      console.error('Error in Drive debug endpoint:', error);
      return NextResponse.json(
        { error: `Error accessing Google Drive: ${error.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unhandled error in Drive debug endpoint:', error);
    return NextResponse.json(
      { error: 'Server error accessing Google Drive' },
      { status: 500 }
    );
  }
} 