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
    console.log('Drive list-files endpoint called');

    // Get folder ID from query parameter if provided
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId');

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
    console.log(`Drive list-files endpoint: Fetching files for Auth User ID: ${authUserId}, Account ID: ${activeAccountId}`);

    try {
      // Get a valid access token for the active account, refreshing if necessary
      const tokenResponse = await getValidAccessToken(authUserId, activeAccountId);

      if (!tokenResponse || !tokenResponse.success || !tokenResponse.accessToken) {
        console.error(`Drive list-files endpoint: Invalid access token for user ${authUserId}, account ${activeAccountId}`);
        return NextResponse.json({ 
          error: tokenResponse?.error || 'Invalid access token. Please re-authenticate Google Drive for this account.' 
        }, { status: 401 });
      }

      // Initialize the Drive API client
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: tokenResponse.accessToken });

      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      // Set a timeout for the Drive API request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Drive API request timed out after ' + (TIMEOUT_MS / 1000) + ' seconds'));
        }, TIMEOUT_MS);
      });

      // Build the query based on whether a folder ID was provided
      let query = "mimeType!='application/vnd.google-apps.folder' and trashed=false";

      // Add folder filter if folderId is provided
      if (folderId && folderId !== 'all') {
        query += ` and '${folderId}' in parents`;
      }

      // Focus on video files
      query += " and (mimeType contains 'video/' or fileExtension='mp4' or fileExtension='mov' or fileExtension='avi' or fileExtension='webm' or fileExtension='mkv')";

      // Perform the actual API request
      const driveRequestPromise = drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, thumbnailLink, webViewLink, createdTime, modifiedTime, size, parents)',
        pageSize: 100,
        orderBy: 'createdTime desc',
        // Include shared files that the user has access to
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      });

      // Race the API request against the timeout
      const response = await Promise.race([driveRequestPromise, timeoutPromise]);

      // Process successful response
      const files = response.data.files || [];
      console.log(`Drive list-files endpoint: Found ${files.length} files, request took ${Date.now() - startTime}ms`);

      return NextResponse.json({ files });
    } catch (error) {
      console.error('Drive list-files endpoint: Error fetching Drive files:', error);

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
    console.error('Drive list-files endpoint: Unhandled error:', error);
    return NextResponse.json(
      { error: 'Server error fetching Drive files' },
      { status: 500 }
    );
  }
}