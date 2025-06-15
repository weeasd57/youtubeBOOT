import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';
import { supabaseAdmin } from '@/utils/supabase';
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

// Get all video files from Google Drive
export async function GET() {
  try {
    console.log("Drive Files API route called - direct listing");
    const session = await getServerSession(authOptions);
    
    if (!session) {
      console.error("No session found");
      return NextResponse.json({ error: 'Not authenticated or active account not set' }, { status: 401 });
    }

    if (!session.user?.email) {
      console.error("Session exists but no user email found");
      console.error("Session exists but no user email found");
      return NextResponse.json({ error: 'User email not found' }, { status: 401 });
    }

    const authUserId = session.user?.auth_user_id;
    const activeAccountId = session.active_account_id;

    if (!authUserId || !activeAccountId) {
        console.error("auth_user_id or active_account_id not found in session", { 
          hasUser: !!session.user,
          authUserId,
          activeAccountId,
          sessionKeys: Object.keys(session)
        });
        return NextResponse.json({ error: 'Authentication information missing in session' }, { status: 401 });
    }

    // Try to get a valid access token, refreshing if necessary
        const result = await getValidAccessToken(authUserId, activeAccountId);
    const accessToken = result?.accessToken;
    const tokenError = result?.error;
    
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
    
    // Direct query for video files with a very inclusive query
    const filesResponse = await executeGoogleDriveAPIWithRetry(
      () => drive.files.list({
        q: "(mimeType contains 'video/' or name contains '.mp4' or name contains '.mov' or name contains '.avi' or name contains '.mkv' or name contains '.wmv') and trashed = false",
        fields: 'files(id, name, mimeType, thumbnailLink, webViewLink, createdTime, size, parents)',
        orderBy: 'createdTime desc',
        pageSize: 100 // Get up to 100 files
      }),
      {
        description: 'Google Drive direct files.list API call'
      }
    );
    
    // Log the found files for debugging
    console.log(`Found ${filesResponse.data.files?.length || 0} video files in direct Drive query`);

    // جلب بيانات الفيديوهات من Supabase - مع التعامل مع الأخطاء
    let tiktokVideos = [];
    try {
      const { data, error } = await supabaseAdmin
        .from('tiktok_videos')
        .select('*')
        .eq('user_email', session.user.email);

      if (error) {
        console.error('Error fetching TikTok videos:', error);
      } else {
        tiktokVideos = data || [];
      }
    } catch (tiktokError) {
      console.error('Exception fetching TikTok videos:', tiktokError);
      // Continue without TikTok data
    }

    // إنشاء قاموس للبيانات المرتبطة بملفات Drive
    const tiktokDataByDriveId = {};
    if (tiktokVideos && tiktokVideos.length > 0) {
      tiktokVideos.forEach(video => {
        if (video.drive_file_id) {
          tiktokDataByDriveId[video.drive_file_id] = {
            title: video.title,
            description: video.description,
            hashtags: video.hashtags
          };
        }
      });
    }

    // دمج بيانات TikTok مع ملفات Drive
    const filesWithMetadata = filesResponse.data.files?.map(file => {
      const tiktokData = tiktokDataByDriveId[file.id];
      return {
        ...file,
        tiktokData: tiktokData || null
      };
    }) || [];

    return NextResponse.json({ files: filesWithMetadata });
  } catch (error) {
    console.error('Error fetching Drive files:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Drive files: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}