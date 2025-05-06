import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';
import { Readable } from 'stream';
import { getValidAccessToken } from '@/utils/refreshToken';

// Helper function to convert ArrayBuffer to Stream
function bufferToStream(buffer) {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

// This endpoint is called by a daily cron job to process scheduled uploads
// Configured with Vercel Cron Jobs (https://vercel.com/docs/cron-jobs)
export async function GET(request) {
  try {
    // Verify the request is from a cron job or authorized source
    // In production, you should use a secret token header
    const authHeader = request.headers.get('authorization');
    
    if (process.env.NODE_ENV === 'production' && 
        (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get current time and a time window for the next 24 hours
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(now.getHours() + 24); // Look 24 hours ahead
    
    console.log(`Checking for scheduled uploads between ${now.toISOString()} and ${tomorrow.toISOString()}`);
    
    // Find scheduled uploads that are due within the next 24 hours
    const { data: scheduledUploads, error: fetchError } = await supabaseAdmin
      .from('scheduled_uploads')
      .select('*')
      .eq('status', 'pending')
      .gte('scheduled_time', now.toISOString())
      .lt('scheduled_time', tomorrow.toISOString())
      .order('scheduled_time', { ascending: true });
    
    if (fetchError) {
      console.error('Error fetching scheduled uploads:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch scheduled uploads', 
        details: fetchError.message 
      }, { status: 500 });
    }
    
    if (!scheduledUploads || scheduledUploads.length === 0) {
      return NextResponse.json({ message: 'No uploads scheduled for the next 24 hours' });
    }
    
    console.log(`Found ${scheduledUploads.length} scheduled uploads for the next 24 hours`);
    
    // Group uploads by scheduled time into buckets
    // This allows us to simulate the every-5-minute cron job by processing in batches
    const uploadsByTimeBucket = {};
    
    for (const upload of scheduledUploads) {
      const scheduledTime = new Date(upload.scheduled_time);
      // Create buckets by rounding to 5-minute intervals
      const minutes = scheduledTime.getMinutes();
      const roundedMinutes = Math.floor(minutes / 5) * 5;
      
      scheduledTime.setMinutes(roundedMinutes, 0, 0);
      const bucket = scheduledTime.toISOString();
      
      if (!uploadsByTimeBucket[bucket]) {
        uploadsByTimeBucket[bucket] = [];
      }
      
      uploadsByTimeBucket[bucket].push(upload);
    }
    
    const allResults = [];
    const bucketTimes = Object.keys(uploadsByTimeBucket).sort();
    
    console.log(`Processing ${bucketTimes.length} time buckets for scheduled uploads`);
    
    // Process each time bucket
    for (const bucketTime of bucketTimes) {
      const uploadsInBucket = uploadsByTimeBucket[bucketTime];
      const bucketDate = new Date(bucketTime);
      
      // Skip buckets in the future (more than 5 minutes from now)
      if (bucketDate > new Date(now.getTime() + 5 * 60 * 1000)) {
        console.log(`Skipping future bucket ${bucketTime} with ${uploadsInBucket.length} uploads`);
        continue;
      }
      
      console.log(`Processing bucket ${bucketTime} with ${uploadsInBucket.length} uploads`);
      
      // Process each scheduled upload in this time bucket
      for (const upload of uploadsInBucket) {
        try {
          // Update status to processing
          await supabaseAdmin
            .from('scheduled_uploads')
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', upload.id);
          
          // Get a valid access token for this user, refreshing if necessary
          const accessToken = await getValidAccessToken(upload.user_email);
          
          if (!accessToken) {
            throw new Error('Failed to get valid access token for user');
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
          
          allResults.push({
            id: upload.id,
            status: 'success',
            videoId,
            videoUrl,
            scheduledFor: upload.scheduled_time
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
          
          allResults.push({
            id: upload.id,
            status: 'error',
            error: error.message,
            scheduledFor: upload.scheduled_time
          });
        }
      }
    }
    
    return NextResponse.json({
      message: `Processed ${allResults.length} of ${scheduledUploads.length} scheduled uploads`,
      processedCount: allResults.length,
      totalScheduled: scheduledUploads.length,
      results: allResults
    });
    
  } catch (error) {
    console.error('Error in processing scheduled uploads:', error);
    return NextResponse.json(
      { error: 'Failed to process scheduled uploads', details: error.message },
      { status: 500 }
    );
  }
} 