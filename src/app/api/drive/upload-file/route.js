import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';
import { saveTikTokVideoData } from '@/utils/supabase';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const folderId = formData.get('folderId');
    const title = formData.get('title') || 'TikTok Video';
    const description = formData.get('description') || '';
    const originalUrl = formData.get('originalUrl') || '';
    const downloadUrl = formData.get('downloadUrl') || '';
    
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
    
    // Prepare the file as a buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Upload the file to Google Drive
    const response = await drive.files.create({
      requestBody: {
        name: file.name,
        description: description,
        parents: [folderId],
        mimeType: file.type,
      },
      media: {
        mimeType: file.type,
        body: buffer,
      },
      fields: 'id,name,webViewLink',
    });
    
    // Extract video ID from the TikTok URL
    let videoId = null;
    if (originalUrl) {
      // Handle different TikTok URL formats
      const tiktokIdRegex = /\/video\/(\d+)|vm\.tiktok\.com\/(\w+)|tiktok\.com\/@[^\/]+\/video\/(\d+)/;
      const matches = originalUrl.match(tiktokIdRegex);
      if (matches) {
        videoId = matches[1] || matches[2] || matches[3];
      }
    }
    
    // Save video data to Supabase
    await saveTikTokVideoData(session.user.email, {
      videoId,
      title,
      description,
      originalUrl,
      downloadUrl,
      driveFolderId: folderId,
      driveFileId: response.data.id
    });
    
    return NextResponse.json({
      fileId: response.data.id,
      fileName: response.data.name,
      webViewLink: response.data.webViewLink
    });
  } catch (error) {
    console.error('Error uploading file to Drive:', error);
    return NextResponse.json(
      { error: 'Failed to upload file to Google Drive: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
} 