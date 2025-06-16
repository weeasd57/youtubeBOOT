import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { google } from 'googleapis';
import { getValidAccessToken } from '@/utils/refreshToken';
import { isAuthError, isQuotaError } from '@/utils/apiHelpers';
import { API_TIMEOUTS } from '@/utils/api-config';

export async function GET(request) {
  try {
    // Get the user session
    const session = await getServerSession(authOptions);
    if (!session) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the active account from the request
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId') || session.user?.activeAccountId;

    if (!accountId) {
      return new Response(JSON.stringify({ message: 'No active account selected' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get a valid access token
    const tokenResponse = await getValidAccessToken(session.user?.auth_user_id, accountId);

    if (!tokenResponse || !tokenResponse.success || !tokenResponse.accessToken) {
      console.error('Error getting valid access token:', tokenResponse?.error);
      return new Response(JSON.stringify({ 
        message: tokenResponse?.error || 'Failed to get access token' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Initialize the Drive API client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: tokenResponse.accessToken });
    
    const drive = google.drive({
      version: 'v3',
      auth: oauth2Client
    });

    // Set a timeout for the API request
    const timeout = setTimeout(() => {
      throw new Error('Drive API request timed out after 45 seconds');
    }, API_TIMEOUTS.DRIVE);

    try {
      // Query for folders in the root directory
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name, mimeType, parents)',
        orderBy: 'name',
        pageSize: 100, // Increased from default 30 to reduce pagination needs
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      clearTimeout(timeout);

      // Return the folders
      return new Response(JSON.stringify({ folders: response.data.files }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        },
      });
    } catch (driveError) {
      clearTimeout(timeout);

      // Handle specific Drive API errors
      if (isAuthError(driveError)) {
        console.error('Drive API authentication error:', driveError.message);
        return new Response(JSON.stringify({ message: 'Authentication error: ' + driveError.message }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (isQuotaError(driveError)) {
        console.error('Drive API quota exceeded:', driveError.message);
        return new Response(JSON.stringify({ message: 'API quota exceeded. Please try again later.' }), {
          status: 429,
          headers: { 
            'Content-Type': 'application/json',
            'Retry-After': '300' // Suggest retry after 5 minutes
          },
        });
      }

      if (driveError.message?.includes('timeout')) {
        console.error('Drive API request timed out');
        return new Response(JSON.stringify({ message: 'Request timed out. Please try again later.' }), {
          status: 504,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check for permission issues
      if (driveError.code === 403 || driveError.response?.status === 403) {
        console.error('Drive API permission error:', driveError.message);
        return new Response(JSON.stringify({ message: 'Permission denied: ' + driveError.message }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Generic error handler
      console.error('Drive API error:', driveError);
      return new Response(JSON.stringify({ message: 'Drive API error: ' + driveError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Server error in list-folders API:', error);
    return new Response(JSON.stringify({ message: 'Server error: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}