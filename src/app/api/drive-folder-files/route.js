import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

// Helper function for executing Google Drive API calls with retry logic
async function executeGoogleDriveAPIWithRetry(apiCall, options = {}) {
  const { 
    maxRetries = 3, 
    baseDelay = 1000,
    description = 'Google Drive API call'
  } = options;
  
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt}/${maxRetries} for ${description}`);
        // Add exponential backoff delay
        const delay = baseDelay * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      return await apiCall();
    } catch (error) {
      lastError = error;
      console.error(`Error in ${description} (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
      
      // Check if we should retry based on error type
      const isTransientError = 
        error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.message?.includes('network') ||
        (error.response?.status >= 500 && error.response?.status < 600) ||
        error.response?.status === 429;
      
      // Don't retry on authentication or permission errors
      const isAuthError = 
        error.response?.status === 401 || 
        error.response?.status === 403;
      
      if (!isTransientError || isAuthError || attempt === maxRetries) {
        throw error;
      }
    }
  }
  
  // This should not be reached, but just in case
  throw lastError;
}

// Get files from a specific folder in Google Drive
export async function GET(request) {
  try {
    // Get folderId from the query string
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');
    
    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }
    
    console.log(`Drive Folder Files API route called for folder: ${folderId}`);
    const session = await getServerSession(authOptions);
    
    if (!session) {
      console.error("No session found");
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!session.user?.email) {
      console.error("Session exists but no user email found");
      return NextResponse.json({ error: 'User email not found' }, { status: 401 });
    }

    // Try to get a valid access token, refreshing if necessary
    const accessToken = await getValidAccessToken(session.user.email);
    
    if (!accessToken) {
      console.error("Failed to get valid access token");
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
    }

    console.log("Valid access token obtained, initializing Drive API");
    
    // Initialize the Drive API client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Check if folder exists
    try {
      await executeGoogleDriveAPIWithRetry(
        () => drive.files.get({
          fileId: folderId,
          fields: 'id, name, mimeType'
        }),
        {
          description: 'Google Drive files.get API call'
        }
      );
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }
      throw error;
    }
    
    // Get files from the folder (first check all files to see what's there)
    const allFilesResponse = await executeGoogleDriveAPIWithRetry(
      () => drive.files.list({
        q: `'${folderId}' in parents`,
        fields: 'files(id, name, mimeType)',
        orderBy: 'createdTime desc'
      }),
      {
        description: 'Google Drive all files list API call'
      }
    );
    
    // Log all files in the folder to debug
    console.log(`All files in folder ${folderId}:`, {
      fileCount: allFilesResponse.data.files?.length || 0,
      files: allFilesResponse.data.files?.map(f => ({ 
        id: f.id, 
        name: f.name, 
        mimeType: f.mimeType 
      }))
    });
    
    // Now get video files with a more inclusive query
    const filesResponse = await executeGoogleDriveAPIWithRetry(
      () => drive.files.list({
        q: `'${folderId}' in parents and (mimeType contains 'video/' or name contains '.mp4' or name contains '.mov' or name contains '.avi' or name contains '.mkv' or name contains '.wmv') and trashed = false`,
        fields: 'files(id, name, mimeType, thumbnailLink, webViewLink, createdTime, size, parents)',
        orderBy: 'createdTime desc',
        pageSize: 100 // Increase page size to get more files
      }),
      {
        description: 'Google Drive folder files.list API call'
      }
    );
    
    // Add detailed logging
    console.log(`Video files in folder ${folderId}:`, {
      fileCount: filesResponse.data.files?.length || 0,
      files: filesResponse.data.files?.map(f => ({ 
        id: f.id, 
        name: f.name, 
        mimeType: f.mimeType 
      }))
    });
    
    return NextResponse.json({ 
      files: filesResponse.data.files || [],
      folderId: folderId
    });
  } catch (error) {
    console.error('Error fetching Drive folder files:', error);
    
    // Check for specific error types
    let status = 500;
    let message = 'Failed to fetch files from Google Drive folder';
    
    // Google API error object often has a detailed structure
    if (error.response && error.response.data) {
      const googleError = error.response.data.error;
      
      // Log detailed Google API error info for debugging
      console.error('Google API error details:', {
        code: googleError.code,
        message: googleError.message,
        errors: googleError.errors,
        status: googleError.status
      });
      
      // Handle rate limiting
      if (googleError.code === 403 && googleError.errors?.some(e => e.reason === 'rateLimitExceeded')) {
        status = 429; // Too Many Requests
        message = 'Google Drive API rate limit exceeded. Please try again later.';
      } 
      // Handle quota exceeded
      else if (googleError.code === 403 && googleError.errors?.some(e => e.reason === 'quotaExceeded')) {
        status = 429;
        message = 'Google Drive API quota exceeded. Please try again tomorrow.';
      }
      // Handle authentication errors
      else if (googleError.code === 401 || googleError.status === 'UNAUTHENTICATED') {
        status = 401;
        message = 'Authentication error with Google Drive. Please sign in again.';
      }
      // Handle permission errors
      else if (googleError.code === 403) {
        status = 403;
        message = 'Permission denied: You do not have access to these Drive files.';
      }
      // Handle not found
      else if (googleError.code === 404) {
        status = 404;
        message = 'Resource not found in Google Drive.';
      }
      // Include the Google error message for other cases
      else {
        message = `${message}: ${googleError.message}`;
      }
    } 
    // Handle fetch/network errors
    else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.message?.includes('network')) {
      status = 503; // Service Unavailable
      message = 'Network error connecting to Google Drive. Please check your connection.';
    }
    
    return NextResponse.json(
      { 
        error: message,
        errorDetails: error.message || 'Unknown error',
        timeStamp: new Date().toISOString()
      },
      { status }
    );
  }
} 