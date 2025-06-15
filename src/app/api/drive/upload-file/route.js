import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';
import { saveTikTokVideoData } from '@/utils/supabase-server';
import axios from 'axios';

// Increase the timeout for Drive API requests
const TIMEOUT_MS = 45000; // 45 seconds

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const folderId = formData.get('folderId');
    const title = formData.get('title') || 'TikTok Video';
    const description = formData.get('description') || '';
    const originalUrl = formData.get('originalUrl') || '';
    const downloadUrl = formData.get('downloadUrl') || '';
    const videoId = formData.get('videoId') || '';
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!folderId) {
      return NextResponse.json({ error: 'No folder ID provided' }, { status: 400 });
    }
    
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
    console.log(`Drive upload-file: Uploading file for Auth User ID: ${authUserId}, Account ID: ${activeAccountId}`);

    try {
      // Get a valid access token for the active account, refreshing if necessary
      const result = await getValidAccessToken(authUserId, activeAccountId);
      
      if (!result.success) {
        console.error(`Drive upload-file: Invalid access token for user ${authUserId}, account ${activeAccountId}: ${result.error}`);
        return NextResponse.json({ error: result.error || 'Invalid access token. Please re-authenticate Google Drive for this account.' }, { status: 401 });
      }

      const accessToken = result.accessToken;
      
      // Initialize the Drive API client
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: accessToken,
      });

      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      // Get file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Set timeout for upload operations
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Drive upload request timed out after ' + (TIMEOUT_MS / 1000) + ' seconds'));
        }, TIMEOUT_MS);
      });
      
      // Using a two-step upload approach that works better with binary data
      
      // Step 1: Create the file metadata without content
      const fileMetadata = {
        name: file.name,
        description: description,
        parents: [folderId],
        mimeType: file.type,
      };
      
      // Create an empty file first
      const createPromise = drive.files.create({
        requestBody: fileMetadata,
        fields: 'id'
      });
      
      const createResponse = await Promise.race([createPromise, timeoutPromise]);
      const fileId = createResponse.data.id;
      
      // Step 2: Update the file content using direct axios call which handles binary data better
      const uploadPromise = axios({
        method: 'PATCH',
        url: `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': file.type
        },
        data: buffer,
        timeout: TIMEOUT_MS
      });
      
      await Promise.race([uploadPromise, timeoutPromise]);
      
      // Get the updated file info
      const getPromise = drive.files.get({
        fileId: fileId,
        fields: 'id,name,webViewLink'
      });
      
      const getResponse = await Promise.race([getPromise, timeoutPromise]);
      
      // Save video data to Supabase with account information
      await saveTikTokVideoData(authUserId, activeAccountId, {
        videoId,
        title,
        description,
        originalUrl,
        downloadUrl,
        driveFolderId: folderId,
        driveFileId: fileId
      });
      
      return NextResponse.json({
        fileId: getResponse.data.id,
        fileName: getResponse.data.name,
        webViewLink: getResponse.data.webViewLink
      });
    } catch (error) {
      console.error('Drive upload-file: Error uploading file to Drive:', error);
      
      // Handle timeout errors
      if (error.message.includes('timed out')) {
        return NextResponse.json(
          { 
            error: 'Drive upload request timed out. Please try again or check your internet connection.',
            errorCode: 'TIMEOUT_ERROR',
            status: 504
          }, 
          { status: 504 }
        );
      }
      
      // Check for specific error types and provide better feedback
      if (error.status === 403 || (error.response && error.response.status === 403)) {
        return NextResponse.json(
          { 
            error: 'Insufficient permissions to upload to Google Drive. Please check your Google account permissions and try refreshing your authentication.',
            errorCode: 'PERMISSION_DENIED',
            status: 403
          }, 
          { status: 403 }
        );
      }
      
      // Check for authentication errors
      if (error.status === 401 || (error.response && error.response.status === 401)) {
        return NextResponse.json(
          { 
            error: 'Authentication error. Please re-authenticate Google Drive for this account.',
            errorCode: 'AUTH_ERROR',
            status: 401
          }, 
          { status: 401 }
        );
      }
      
      // Handle network errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        return NextResponse.json(
          { 
            error: 'Network error connecting to Google Drive. Please check your internet connection and try again.',
            errorCode: 'NETWORK_ERROR',
            status: 500
          }, 
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to upload file to Google Drive: ' + (error.message || 'Unknown error'),
          errorCode: 'UPLOAD_FAILED',
          status: 500
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Drive upload-file: Unhandled error:', error);
    return NextResponse.json(
      { 
        error: 'Server error uploading file to Drive',
        errorCode: 'SERVER_ERROR',
        status: 500
      },
      { status: 500 }
    );
  }
}