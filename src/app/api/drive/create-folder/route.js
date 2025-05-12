import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

export async function POST(req) {
  try {
    const { folderName = 'TikTok Downloads' } = await req.json();
    
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!session.user?.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 401 });
    }

    // Try to get a valid access token, refreshing if necessary
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

    // First, check if folder already exists
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    let folderId;

    if (response.data.files && response.data.files.length > 0) {
      // Use existing folder
      folderId = response.data.files[0].id;
    } else {
      // Create new folder
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      };
      
      const folder = await drive.files.create({
        resource: folderMetadata,
        fields: 'id'
      });
      
      folderId = folder.data.id;
    }
    
    return NextResponse.json({ folderId });
  } catch (error) {
    console.error('Error creating Drive folder:', error);
    return NextResponse.json(
      { error: 'Failed to create folder in Google Drive: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
} 