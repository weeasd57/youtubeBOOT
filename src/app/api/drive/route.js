import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

// Increase the timeout for Drive API requests
const TIMEOUT_MS = 45000; // 45 seconds

// List video files from Google Drive
export async function GET() {
  try {
    console.log("Drive API route called");
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.auth_user_id || !session.active_account_id) {
      console.log('Session missing required fields:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasAuthUserId: !!session?.user?.auth_user_id,
        hasActiveAccountId: !!session?.active_account_id
      });
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const authUserId = session.user.auth_user_id;
    const activeAccountId = session.active_account_id;
    console.log(`Drive API route: Fetching files for Auth User ID: ${authUserId}, Account ID: ${activeAccountId}`);

    try {
      // Get a valid access token for the active account, refreshing if necessary
          const result = await getValidAccessToken(authUserId, activeAccountId);
    const accessToken = result?.accessToken;
    const tokenError = result?.error;
      
      if (!result || tokenError || !accessToken) {
        console.error(`Drive API route: Invalid access token for user ${authUserId}, account ${activeAccountId}`);
        return NextResponse.json({ error: 'Invalid access token. Please re-authenticate Google Drive for this account.' }, { status: 401 });
      }

      console.log("Valid access token obtained, initializing Drive API");
      
      // Initialize the Drive API client
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: accessToken,
      });

      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      // Set a timeout for the Drive API request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Drive API request timed out after ' + (TIMEOUT_MS / 1000) + ' seconds'));
        }, TIMEOUT_MS);
      });

      console.log("Querying Drive API for video files");
      
      // Query for video files with broader support
      const driveRequestPromise = drive.files.list({
        q: "mimeType contains 'video/' and trashed=false",
        fields: 'files(id, name, mimeType, thumbnailLink, webViewLink, createdTime, modifiedTime, size, parents)',
        pageSize: 100,
        orderBy: 'createdTime desc',
        // Include shared files that the user has access to
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      });

      // Race the API request against the timeout
      const response = await Promise.race([driveRequestPromise, timeoutPromise]);

      console.log(`Drive API returned ${response.data.files?.length || 0} files`);
      
      return NextResponse.json({ files: response.data.files || [] });
    } catch (error) {
      console.error('Drive API route: Error fetching Drive files:', error);

      // Handle specific error scenarios
      if (error.message.includes('timed out')) {
        return NextResponse.json(
          { error: 'Drive API request timed out. Please try again or refresh your authentication.' },
          { status: 504 } // Gateway Timeout
        );
      }

      // Check for permission errors
      if (error.code === 403 ||
        (error.response && error.response.status === 403) ||
        (error.message && error.message.includes('permission'))) {
        return NextResponse.json(
          { error: 'Insufficient permissions to access Drive files. Please check your Google account permissions.' },
          { status: 403 }
        );
      }

      // Check for authentication errors
      if (error.code === 401 ||
        (error.response && error.response.status === 401) ||
        (error.message && (error.message.includes('auth') || error.message.includes('token')))) {
        return NextResponse.json(
          { error: 'Authentication error. Please re-authenticate Google Drive for this account.' },
          { status: 401 }
        );
      }

      // Network or other errors
      return NextResponse.json(
        { error: `Error fetching Drive files: ${error.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Drive API route: Unhandled error:', error);
    return NextResponse.json(
      { error: 'Server error fetching Drive files' },
      { status: 500 }
    );
  }
}