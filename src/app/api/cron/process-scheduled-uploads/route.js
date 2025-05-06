import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';
import { Readable } from 'stream';

// Helper function to convert ArrayBuffer to Stream
function bufferToStream(buffer) {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

// This endpoint should be called by a cron job to process scheduled uploads
// Can be configured with Vercel Cron Jobs (https://vercel.com/docs/cron-jobs)
export async function GET(request) {
  try {
    // Verify the request is from a cron job or authorized source
    // In production, you should use a secret token header
    const authHeader = request.headers.get('authorization');
    
    if (process.env.NODE_ENV === 'production' && 
        (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get current time with 1-minute buffer
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1); // Add 1 minute buffer
    
    // Find scheduled uploads that are due
    const { data: scheduledUploads, error: fetchError } = await supabaseAdmin
      .from('scheduled_uploads')
      .select('*')
      .eq('status', 'pending')
      .lt('scheduled_time', now.toISOString())
      .order('scheduled_time', { ascending: true });
    
    if (fetchError) {
      console.error('Error fetching scheduled uploads:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch scheduled uploads', 
        details: fetchError.message 
      }, { status: 500 });
    }
    
    if (!scheduledUploads || scheduledUploads.length === 0) {
      return NextResponse.json({ message: 'No uploads scheduled for processing' });
    }
    
    console.log(`Processing ${scheduledUploads.length} scheduled uploads`);
    
    const results = [];
    
    // Process each scheduled upload
    for (const upload of scheduledUploads) {
      try {
        // Update status to processing
        await supabaseAdmin
          .from('scheduled_uploads')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', upload.id);
        
        // Get user's access token
        const { data: authUser } = await supabaseAdmin.auth.admin.listUsers({
          filters: {
            email: upload.user_email
          }
        });
        
        // Check if we have an access token for this user
        let accessToken;
        // If not in auth, try to find in your NextAuth tables
        // This depends on your NextAuth configuration, you might need to adjust
        
        // For this example, we'll assume using supabase table for token storage
        const { data: tokenData } = await supabaseAdmin
          .from('user_tokens')
          .select('access_token')
          .eq('user_email', upload.user_email)
          .single();
        
        if (tokenData) {
          accessToken = tokenData.access_token;
        } else {
          throw new Error('User access token not found');
        }
        
        // Initialize the OAuth2 client
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({
          access_token: accessToken,
        });
        
        // Initialize Drive API to get the file
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        // Get file details first
        const fileDetails = await drive.files.get({
          fileId: upload.file_id,
          fields: 'id,name',
        });
        
        // Get the file content from Drive
        const fileResponse = await drive.files.get({
          fileId: upload.file_id,
          alt: 'media',
          acknowledgeAbuse: true,
        }, { responseType: 'arraybuffer' });
        
        const fileContent = fileResponse.data;
        
        // Initialize YouTube API
        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
        
        // Format title to include #Shorts if not already present
        const formattedTitle = upload.title.includes('#Shorts') 
          ? upload.title 
          : `${upload.title} #Shorts`;
        
        // Create the video resource
        const videoResource = {
          snippet: {
            title: formattedTitle,
            description: upload.description || 'Uploaded from Google Drive',
            categoryId: '22', // People & Blogs category
          },
          status: {
            privacyStatus: 'public',
            selfDeclaredMadeForKids: false,
          },
        };
        
        // Convert the file content to a readable stream for the YouTube API
        const mediaStream = bufferToStream(fileContent);
        
        // Upload the video to YouTube
        const uploadResponse = await youtube.videos.insert({
          part: 'snippet,status',
          requestBody: videoResource,
          media: {
            body: mediaStream,
          },
        });
        
        const videoId = uploadResponse.data.id;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        // Update scheduled upload with success
        await supabaseAdmin
          .from('scheduled_uploads')
          .update({
            status: 'completed',
            youtube_video_id: videoId,
            youtube_url: videoUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', upload.id);
        
        // Also log this upload in upload_logs table
        await supabaseAdmin
          .from('upload_logs')
          .insert({
            user_email: upload.user_email,
            video_id: videoId,
            file_id: upload.file_id,
            file_name: upload.file_name,
            youtube_url: videoUrl,
            title: formattedTitle,
            status: 'success',
            created_at: new Date().toISOString()
          });
        
        results.push({
          id: upload.id,
          status: 'success',
          videoId,
          videoUrl
        });
        
      } catch (error) {
        console.error(`Error processing scheduled upload ${upload.id}:`, error);
        
        // Update scheduled upload with error
        await supabaseAdmin
          .from('scheduled_uploads')
          .update({
            status: 'failed',
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', upload.id);
        
        // Also log this error in upload_logs table
        await supabaseAdmin
          .from('upload_logs')
          .insert({
            user_email: upload.user_email,
            file_id: upload.file_id,
            file_name: upload.file_name,
            title: upload.title,
            status: 'error',
            error_message: error.message,
            created_at: new Date().toISOString()
          });
        
        results.push({
          id: upload.id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return NextResponse.json({
      message: `Processed ${scheduledUploads.length} scheduled uploads`,
      results
    });
    
  } catch (error) {
    console.error('Error in processing scheduled uploads:', error);
    return NextResponse.json(
      { error: 'Failed to process scheduled uploads', details: error.message },
      { status: 500 }
    );
  }
} 