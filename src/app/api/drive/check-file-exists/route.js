import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

// Increase the timeout for Drive API requests
const TIMEOUT_MS = 45000; // 45 seconds

export async function GET(request) {
  try {
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

    const authUserId = session.user.auth_user_id;
    const activeAccountId = session.active_account_id;
    console.log(`Drive check-file-exists: Checking file for Auth User ID: ${authUserId}, Account ID: ${activeAccountId}`);

    try {
      // Get a valid access token for the active account
          const result = await getValidAccessToken(authUserId, activeAccountId);
    const accessToken = result?.accessToken;
    const tokenError = result?.error;
      
      if (!result || tokenError || !accessToken) {
        console.error(`Drive check-file-exists: Invalid access token for user ${authUserId}, account ${activeAccountId}`);
        return NextResponse.json({ error: 'Invalid access token. Please re-authenticate Google Drive for this account.' }, { status: 401 });
      }

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
      
      // Search for files in the specified folder that contain the videoId in their name
      const listPromise = drive.files.list({
        q: `'${folderId}' in parents and name contains 'tiktok-${videoId}' and trashed=false`,
        fields: 'files(id, name, mimeType, webViewLink)',
        spaces: 'drive',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      });
      
      const response = await Promise.race([listPromise, timeoutPromise]);
      const files = response.data.files || [];
      
      if (files.length > 0) {
        // File exists
        console.log(`Drive check-file-exists: File found - ${files[0].name}`);
        return NextResponse.json({ 
          exists: true, 
          fileId: files[0].id,
          fileName: files[0].name,
          webViewLink: files[0].webViewLink
        });
      } else {
        // File doesn't exist
        console.log(`Drive check-file-exists: File not found for video ID: ${videoId}`);
        return NextResponse.json({ exists: false });
      }
    } catch (error) {
      console.error('Drive check-file-exists: Error checking file existence:', error);
      
      // Handle timeout errors
      if (error.message.includes('timed out')) {
        return NextResponse.json({ 
          error: 'Drive API request timed out. Please try again.',
          exists: false 
        }, { status: 504 });
      }

      // Check for permission errors
      if (error.code === 403 ||
        (error.response && error.response.status === 403) ||
        (error.message && error.message.includes('permission'))) {
        return NextResponse.json({ 
          error: 'Insufficient permissions to access Google Drive files.',
          exists: false 
        }, { status: 403 });
      }

      // Check for authentication errors
      if (error.code === 401 ||
        (error.response && error.response.status === 401) ||
        (error.message && (error.message.includes('auth') || error.message.includes('token')))) {
        return NextResponse.json({ 
          error: 'Authentication error. Please re-authenticate Google Drive for this account.',
          exists: false 
        }, { status: 401 });
      }

      return NextResponse.json({ 
        error: 'Failed to check file existence',
        details: error.message,
        exists: false 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Drive check-file-exists: Unhandled error:', error);
    return NextResponse.json({ 
      error: 'Server error checking file existence',
      details: error.message,
      exists: false
    }, { status: 500 });
  }
}