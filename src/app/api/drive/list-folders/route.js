import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

// Increase the timeout for Drive API requests
const TIMEOUT_MS = 45000; // 45 seconds (increased from 25s)

export async function GET(req) {
  try {
    const startTime = Date.now();
    console.log('Drive list-folders endpoint called');

    const session = await getServerSession(authOptions);

    if (!session || !session.authUserId || !session.activeAccountId) {
      return NextResponse.json({ error: 'Not authenticated or active account not set' }, { status: 401 });
    }

    const authUserId = session.authUserId;
    const activeAccountId = session.activeAccountId;
    console.log(`Drive list-folders endpoint: Fetching folders for Auth User ID: ${authUserId}, Account ID: ${activeAccountId}`);

    try {
      // Get a valid access token for the active account, refreshing if necessary
      const accessToken = await getValidAccessToken(authUserId, activeAccountId);

      if (!accessToken) {
        console.error(`Drive list-folders endpoint: Invalid access token for user ${authUserId}, account ${activeAccountId}`);
        return NextResponse.json({ error: 'Invalid access token. Please re-authenticate Google Drive for this account.' }, { status: 401 });
      }

      // Initialize the Drive API client
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });

      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      // Set a timeout for the Drive API request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Drive API request timed out after ' + (TIMEOUT_MS / 1000) + ' seconds'));
        }, TIMEOUT_MS);
      });

      // Perform the actual API request with a comprehensive folder query
      const driveRequestPromise = drive.files.list({
        // Use the 'in parents' query to find all folders in the root of Drive
        q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
        fields: 'files(id, name, parents, mimeType, createdTime)',
        pageSize: 100,
        orderBy: 'createdTime desc',
        // Include shared folders that the user has access to
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      });

      // Race the API request against the timeout
      const response = await Promise.race([driveRequestPromise, timeoutPromise]);

      // Process successful response
      const folders = response.data.files || [];
      console.log(`Drive list-folders endpoint: Found ${folders.length} folders, request took ${Date.now() - startTime}ms`);

      // Log all folders for debugging
      if (folders.length > 0) {
        console.log('Drive list-folders endpoint: Folders found in Drive:');
        folders.forEach(folder => {
          console.log(`- ${folder.name} (${folder.id}, ${folder.mimeType})`);
        });
      }

      return NextResponse.json({ folders });
    } catch (error) {
      console.error('Drive list-folders endpoint: Error fetching Drive folders:', error);

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
          { error: 'Insufficient permissions to access Drive folders. Please check your Google account permissions.' },
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
        { error: `Error fetching Drive folders: ${error.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Drive list-folders endpoint: Unhandled error:', error);
    return NextResponse.json(
      { error: 'Server error fetching Drive folders' },
      { status: 500 }
    );
  }
}