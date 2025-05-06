import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

// List video files from Google Drive
export async function GET() {
  try {
    console.log("Drive API route called");
    const session = await getServerSession(authOptions);
    
    if (!session) {
      console.error("No session found");
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!session.user?.email) {
      console.error("Session exists but no user email found");
      return NextResponse.json({ error: 'User email not found' }, { status: 401 });
    }

    // Try to get a valid access token, refreshing if necessary
    const accessToken = await getValidAccessToken(session.user.email);
    
    if (!accessToken) {
      console.error("Failed to get valid access token");
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
    }

    console.log("Valid access token obtained, initializing Drive API");
    
    // Initialize the Drive API client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    console.log("Querying Drive API for MP4 files");
    
    // Query for video files (MP4)
    const response = await drive.files.list({
      q: "mimeType contains 'video/mp4'",
      fields: 'files(id, name, mimeType, thumbnailLink, webViewLink, createdTime, size)',
      orderBy: 'createdTime desc'
    });

    console.log(`Drive API returned ${response.data.files?.length || 0} files`);
    
    return NextResponse.json({ files: response.data.files || [] });
  } catch (error) {
    console.error('Error fetching Drive files:', error);
    return NextResponse.json(
      { error: 'Failed to fetch files from Google Drive: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}