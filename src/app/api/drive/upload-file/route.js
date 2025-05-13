import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';
import { saveTikTokVideoData } from '@/utils/supabase-server';
import axios from 'axios';

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
    
    // Get file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Using a two-step upload approach that works better with binary data
    
    // Step 1: Create the file metadata without content
    const fileMetadata = {
      name: file.name,
      description: description,
      parents: [folderId],
      mimeType: file.type,
    };
    
    // Create an empty file first
    const createResponse = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id'
    });
    
    const fileId = createResponse.data.id;
    
    // Step 2: Update the file content using direct axios call which handles binary data better
    await axios({
      method: 'PATCH',
      url: `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': file.type
      },
      data: buffer
    });
    
    // Get the updated file info
    const getResponse = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,webViewLink'
    });
    
    // Save video data to Supabase
    await saveTikTokVideoData(session.user.email, {
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
    console.error('Error uploading file to Drive:', error);
    
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
} 