import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

// Increase the timeout for Drive API requests
const TIMEOUT_MS = 45000; // 45 seconds

// API endpoint to check if a folder exists in Google Drive
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.authUserId || !session.activeAccountId) {
      return NextResponse.json({ error: 'Not authenticated or active account not set' }, { status: 401 });
    }

    // Get folder ID from query parameters
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');
    
    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    const authUserId = session.authUserId;
    const activeAccountId = session.activeAccountId;
    console.log(`Drive check-folder: Checking folder for Auth User ID: ${authUserId}, Account ID: ${activeAccountId}`);

    try {
      // Get a valid access token for the active account
      const accessToken = await getValidAccessToken(authUserId, activeAccountId);
      
      if (!accessToken) {
        console.error(`Drive check-folder: Invalid access token for user ${authUserId}, account ${activeAccountId}`);
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
      
      // Try to get the folder metadata - if it fails, the folder doesn't exist
      const getPromise = drive.files.get({
        fileId: folderId,
        fields: 'id,name,mimeType',
        supportsAllDrives: true
      });
      
      const response = await Promise.race([getPromise, timeoutPromise]);
      const file = response.data;
      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
      
      console.log(`Drive check-folder: Folder ${file.name} exists and is ${isFolder ? 'a folder' : 'not a folder'}`);
      
      return NextResponse.json({ 
        exists: true, 
        isFolder: isFolder,
        name: file.name,
        id: file.id
      });
    } catch (error) {
      console.error('Drive check-folder: Error checking folder:', error);
      
      // Handle timeout errors
      if (error.message.includes('timed out')) {
        return NextResponse.json({ 
          error: 'Drive API request timed out. Please try again.',
          exists: false 
        }, { status: 504 });
      }
      
      // If the error is a 404, the folder doesn't exist
      if (error.code === 404 || (error.response && error.response.status === 404)) {
        console.log(`Drive check-folder: Folder with ID ${folderId} does not exist`);
        return NextResponse.json({ exists: false });
      }

      // Check for permission errors
      if (error.code === 403 ||
        (error.response && error.response.status === 403) ||
        (error.message && error.message.includes('permission'))) {
        return NextResponse.json({ 
          error: 'Insufficient permissions to access this Google Drive folder.',
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
      
      // Other errors should be reported
      return NextResponse.json({ 
        error: 'Failed to check folder',
        details: error.message,
        exists: false 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Drive check-folder: Unhandled error:', error);
    return NextResponse.json({ 
      error: 'Server error checking folder existence',
      details: error.message,
      exists: false
    }, { status: 500 });
  }
}