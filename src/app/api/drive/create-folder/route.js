import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

// Increase the timeout for Drive API requests
const TIMEOUT_MS = 45000; // 45 seconds

export async function POST(req) {
  try {
    const { folderName = 'TikTok Downloads' } = await req.json();
    
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
    console.log(`Drive create-folder: Creating folder for Auth User ID: ${authUserId}, Account ID: ${activeAccountId}`);

    try {
      // Get a valid access token for the active account, refreshing if necessary
      const result = await getValidAccessToken(authUserId, activeAccountId);
      
      if (!result.success) {
        console.error(`Drive create-folder: Invalid access token for user ${authUserId}, account ${activeAccountId}: ${result.error}`);
        return NextResponse.json({ error: result.error || 'Invalid access token. Please re-authenticate Google Drive for this account.' }, { status: 401 });
      }

      const accessToken = result.accessToken;
      
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

      // First, check if folder already exists
      const listPromise = drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      });

      const response = await Promise.race([listPromise, timeoutPromise]);

      let folderId;

      if (response.data.files && response.data.files.length > 0) {
        // Use existing folder
        folderId = response.data.files[0].id;
        console.log(`Drive create-folder: Using existing folder ${folderName} with ID: ${folderId}`);
      } else {
        // Create new folder
        const folderMetadata = {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder'
        };
        
        const createPromise = drive.files.create({
          resource: folderMetadata,
          fields: 'id',
          supportsAllDrives: true
        });
        
        const folder = await Promise.race([createPromise, timeoutPromise]);
        folderId = folder.data.id;
        console.log(`Drive create-folder: Created new folder ${folderName} with ID: ${folderId}`);
      }
      
      return NextResponse.json({ folderId });
    } catch (error) {
      console.error('Drive create-folder: Error creating Drive folder:', error);
      
      // Handle timeout errors
      if (error.message.includes('timed out')) {
        return NextResponse.json(
          { error: 'Drive API request timed out. Please try again or check your internet connection.' },
          { status: 504 }
        );
      }

      // Check for permission errors
      if (error.code === 403 ||
        (error.response && error.response.status === 403) ||
        (error.message && error.message.includes('permission'))) {
        return NextResponse.json(
          { error: 'Insufficient permissions to create folders in Google Drive. Please check your Google account permissions.' },
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
        { error: `Failed to create folder in Google Drive: ${error.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Drive create-folder: Unhandled error:', error);
    return NextResponse.json(
      { error: 'Server error creating Drive folder' },
      { status: 500 }
    );
  }
}