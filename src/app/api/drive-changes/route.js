import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';
import { supabaseAdmin } from '@/utils/supabase';

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

// Get the current page token or start token for tracking changes
async function getPageToken(userEmail) {
  try {
    // Try to get the stored page token from the database
    const { data, error } = await supabaseAdmin
      .from('drive_sync')
      .select('page_token')
      .eq('user_email', userEmail)
      .single();
    
    if (error || !data?.page_token) {
      return null; // No token found or error
    }
    
    return data.page_token;
  } catch (error) {
    console.error('Error retrieving page token:', error);
    return null;
  }
}

// Save the new page token for future change tracking
async function savePageToken(userEmail, pageToken) {
  try {
    const { data, error } = await supabaseAdmin
      .from('drive_sync')
      .upsert(
        { 
          user_email: userEmail, 
          page_token: pageToken,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_email' }
      );
    
    if (error) {
      console.error('Error saving page token:', error);
    }
    
    return !error;
  } catch (error) {
    console.error('Error saving page token:', error);
    return false;
  }
}

// Track changes in Google Drive
export async function GET() {
  try {
    console.log("Drive Changes API route called");
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
    
    // Get stored page token or get a fresh start token
    let pageToken = await getPageToken(session.user.email);
    
    if (!pageToken) {
      console.log("No saved page token, getting a new start token");
      const startPageToken = await drive.changes.getStartPageToken({});
      pageToken = startPageToken.data.startPageToken;
      // Save the start token for future use
      await savePageToken(session.user.email, pageToken);
      
      // No changes to report yet since this is the first time tracking
      return NextResponse.json({ 
        files: [], 
        changes: [],
        newToken: pageToken,
        isFirstSync: true
      });
    }
    
    console.log(`Using page token: ${pageToken} to check for changes`);
    
    // List changes since the last sync with retry
    let changes;
    try {
      changes = await executeGoogleDriveAPIWithRetry(
        () => drive.changes.list({
          pageToken: pageToken,
          spaces: 'drive',
          includeRemoved: true,
          fields: 'changes(fileId,file(id,name,mimeType,thumbnailLink,webViewLink,createdTime,size),removed,time),newStartPageToken'
        }),
        {
          description: 'Google Drive changes.list API call'
        }
      );
    } catch (listError) {
      console.error('Error listing Drive changes:', listError);
      // If there's an issue with the page token, try to get a new start token
      if (listError.message && listError.message.includes('pageToken')) {
        console.log('Invalid page token, requesting a new start token');
        try {
          const startPageToken = await executeGoogleDriveAPIWithRetry(
            () => drive.changes.getStartPageToken({}),
            {
              description: 'Google Drive getStartPageToken API call'
            }
          );
          const newToken = startPageToken.data.startPageToken;
          await savePageToken(session.user.email, newToken);
          
          return NextResponse.json({ 
            files: [], 
            changes: [],
            newToken: newToken,
            isFirstSync: true,
            tokenReset: true,
            message: 'Page token was invalid and has been reset'
          });
        } catch (startTokenError) {
          console.error('Error getting start token:', startTokenError);
          throw new Error('Failed to get a valid start token: ' + startTokenError.message);
        }
      }
      throw listError; // Re-throw if we can't recover
    }
    
    // Filter changes to include all potential video files
    const videoChanges = changes.data.changes.filter(change => {
      // Include if it was removed (we need to track deletions)
      if (change.removed) return true;
      
      // Check if it's a video file by MIME type or file extension
      if (change.file && change.file.name) {
        const name = change.file.name.toLowerCase();
        const isVideoByExtension = name.endsWith('.mp4') || 
                                  name.endsWith('.mov') || 
                                  name.endsWith('.avi') || 
                                  name.endsWith('.mkv') || 
                                  name.endsWith('.wmv');
        
        const isVideoByMimeType = change.file.mimeType && 
                                (change.file.mimeType.includes('video/') || 
                                 change.file.mimeType.includes('application/vnd.google-apps.video'));
        
        return isVideoByExtension || isVideoByMimeType;
      }
      
      return false;
    });
    
    // Save the new page token for next sync
    const newToken = changes.data.newStartPageToken;
    await savePageToken(session.user.email, newToken);
    
    console.log(`Found ${videoChanges.length} video changes out of ${changes.data.changes.length} total changes`);
    
    // Get current list of video files (not removed ones)
    const activeFiles = [];
    
    if (videoChanges.length > 0 || !pageToken) {
      // Query for current video files with a more inclusive query
      try {
        const filesResponse = await executeGoogleDriveAPIWithRetry(
          () => drive.files.list({
            q: "(mimeType contains 'video/' or name contains '.mp4' or name contains '.mov' or name contains '.avi' or name contains '.mkv' or name contains '.wmv') and trashed = false",
            fields: 'files(id, name, mimeType, thumbnailLink, webViewLink, createdTime, size, parents)',
            orderBy: 'createdTime desc',
            pageSize: 100 // Increase page size to get more files
          }),
          {
            description: 'Google Drive files.list API call'
          }
        );
        
        if (filesResponse.data.files) {
          // Log the found files for debugging
          console.log(`Found ${filesResponse.data.files.length} video files in Drive`, 
            filesResponse.data.files.map(f => ({ 
              id: f.id, 
              name: f.name, 
              mimeType: f.mimeType 
            }))
          );
          activeFiles.push(...filesResponse.data.files);
        }
      } catch (filesError) {
        console.error('Error listing video files:', filesError);
        // Continue with empty active files rather than failing completely
        console.log('Continuing with empty files list due to error');
      }
    }
    
    return NextResponse.json({ 
      files: activeFiles, 
      changes: videoChanges,
      newToken: newToken,
      isFirstSync: false
    });
  } catch (error) {
    console.error('Error tracking Drive changes:', error);
    
    // Check for specific error types
    let status = 500;
    let message = 'Failed to track changes in Google Drive';
    
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