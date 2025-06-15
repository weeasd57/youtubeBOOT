import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';
import { isAuthError } from '@/utils/apiHelpers';

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
      


      
      if (!isTransientError || isAuthError || attempt === maxRetries) {
        throw error;
      }
    }
  }
  
  // This should not be reached, but just in case
  throw lastError;
}

// Get folders from Google Drive
export async function GET() {
  try {
    console.log("Drive Folders API route called");
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

    // Try to get a valid access token, refreshing if necessary
    let accessToken;
    try {
          const result = await getValidAccessToken(authUserId, activeAccountId);
    accessToken = result?.accessToken;
    const tokenError = result?.error;
    } catch (tokenError) {
      console.error("Error getting access token:", tokenError);
      // Check if we have a cached token in the session (from previous successful auth)
      if (session.accessToken) {
        console.log("Using cached access token from session");
        accessToken = session.accessToken;
      } else {
        return NextResponse.json({ 
          error: 'Failed to authenticate with Google Drive. Please try refreshing the page.',
          errorDetails: tokenError.message
        }, { status: 401 });
      }
    }
    
    if (!result || tokenError || !accessToken) {
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
    
    // Get all folders from Drive
    const foldersResponse = await executeGoogleDriveAPIWithRetry(
      () => drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and 'me' in owners",
        fields: 'files(id, name, mimeType, createdTime, owners)',
        orderBy: 'name'
      }),
      {
        description: 'Google Drive folders.list API call'
      }
    );
    
    // Get folders and filter out duplicates by name (keep the first instance of each name)
    const folders = foldersResponse.data.files || [];
    const uniqueFolderNames = new Set();
    const uniqueFolders = folders.filter(folder => {
      if (uniqueFolderNames.has(folder.name)) {
        return false; // Skip this one, we already have a folder with this name
      }
      uniqueFolderNames.add(folder.name);
      return true;
    });
    
    return NextResponse.json({ 
      folders: uniqueFolders
    });
  } catch (error) {
    console.error('Error fetching Drive folders:', error);
    
    // Check for specific error types
    let status = 500;
    let message = 'Failed to fetch folders from Google Drive';
    
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