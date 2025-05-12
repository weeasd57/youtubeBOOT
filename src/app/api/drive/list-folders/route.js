import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

// Add a timeout to the Drive API request
const TIMEOUT_MS = 25000; // 25 seconds

export async function GET(req) {
  try {
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

    // Create a promise that rejects after the timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), TIMEOUT_MS);
    });

    // Race the Drive API request against the timeout
    try {
      const response = await Promise.race([
        drive.files.list({
          q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
          fields: 'files(id, name, createdTime)',
          spaces: 'drive',
          orderBy: 'createdTime desc',
          pageSize: 50 // Limit to 50 folders for better performance
        }),
        timeoutPromise
      ]);

      const folders = response.data.files || [];
      
      return NextResponse.json({ folders });
    } catch (raceError) {
      // Handle timeout specifically
      if (raceError.message === 'Request timed out') {
        console.error('Drive API request timed out');
        return NextResponse.json(
          { error: 'Google Drive is not responding. Please try again later.' },
          { status: 504 }
        );
      }
      
      throw raceError; // Re-throw for the outer catch block
    }
  } catch (error) {
    console.error('Error listing Drive folders:', error);
    
    // Check for timeout error
    if (error.message === 'Request timed out') {
      return NextResponse.json(
        { error: 'Google Drive is taking too long to respond. Please try again later.' },
        { status: 504 }
      );
    }
    
    // Check for network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return NextResponse.json(
        { error: 'Network error when connecting to Google Drive.' },
        { status: 503 }
      );
    }
    
    // Check for Google API specific errors
    if (error.errors && Array.isArray(error.errors)) {
      const errorMessage = error.errors.map(e => e.message).join(', ');
      return NextResponse.json(
        { error: `Google API error: ${errorMessage}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to list folders in Google Drive: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
} 