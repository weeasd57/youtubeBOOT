import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';
import { Readable } from 'stream';
import { getValidAccessToken } from '@/utils/refreshToken';

// Helper function to convert ArrayBuffer to Stream
function bufferToStream(buffer) {
  const readable = new Readable();
  readable.push(Buffer.from(buffer)); // Convert ArrayBuffer to Buffer
  readable.push(null);
  return readable;
}

// This endpoint is called by a daily cron job to process scheduled uploads
// Configured with Vercel Cron Jobs (https://vercel.com/docs/cron-jobs)
export async function GET(request) {
  try {
    // Get the API key from the URL query parameters or authorization header
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    // Check if either the API key or the authorization header matches the secret
    const isAuthorized = (apiKey && apiKey === process.env.CRON_API_KEY) || 
                         (headerToken && headerToken === process.env.CRON_SECRET);
    
    if (process.env.NODE_ENV === 'production' && !isAuthorized) {
      console.log('Unauthorized cron job access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get current time and a time window for the next 24 hours
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(now.getHours() + 24); // Look 24 hours ahead
    
    console.log(`Checking for scheduled uploads (all pending)`);
    
    // Find all pending scheduled uploads
    const { data: scheduledUploads, error: fetchError } = await supabaseAdmin
      .from('scheduled_uploads')
      .select('*')
      .eq('status', 'pending')
      .order('scheduled_time', { ascending: true });
    
    if (fetchError) {
      console.error('Error fetching scheduled uploads:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch scheduled uploads', 
        details: fetchError.message 
      }, { status: 500 });
    }
    
    if (!scheduledUploads || scheduledUploads.length === 0) {
      return NextResponse.json({ message: 'No pending uploads found' });
    }
    
    // Filter uploads for immediate processing
    const immediateFutureUploads = scheduledUploads.filter(upload => {
      const scheduledTime = new Date(upload.scheduled_time);
      const timeDifferenceMinutes = (scheduledTime - now) / (1000 * 60);
      
      // If scheduled time is in the past or within 5 minutes from now
      return timeDifferenceMinutes <= 5;
    });
    
    // For uploads scheduled for later, we'll log them only
    const farFutureUploads = scheduledUploads.filter(upload => {
      const scheduledTime = new Date(upload.scheduled_time);
      const timeDifferenceMinutes = (scheduledTime - now) / (1000 * 60);
      
      return timeDifferenceMinutes > 5;
    });
    
    if (farFutureUploads.length > 0) {
      console.log(`Found ${farFutureUploads.length} uploads scheduled for later (>5 minutes)`);
    }
    
    // If there are no uploads for immediate processing
    if (immediateFutureUploads.length === 0) {
      return NextResponse.json({ 
        message: 'No uploads due for immediate processing',
        pendingFuture: farFutureUploads.length
      });
    }
    
    console.log(`Found ${immediateFutureUploads.length} uploads for immediate processing`);
    
    // Group uploads by scheduled time into buckets
    // This allows us to simulate the every-5-minute cron job by processing in batches
    const uploadsByTimeBucket = {};
    
    for (const upload of immediateFutureUploads) {
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
      
      // معالجة جميع الدلاء المجدولة بغض النظر عن وقتها
      console.log(`Processing bucket ${bucketTime} with ${uploadsInBucket.length} uploads`);
      
      // Process each scheduled upload in this time bucket
      for (const upload of uploadsInBucket) {
        try {
          // Update status to processing
          await supabaseAdmin
            .from('scheduled_uploads')
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', upload.id);
          
          // محاولات متعددة للحصول على رمز وصول صالح
          let accessToken = null;
          let tokenError = null;
          
          // محاولة تحديث الرمز عدة مرات (3 محاولات بفاصل زمني)
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              // Get a valid access token for this user, refreshing if necessary
              accessToken = await getValidAccessToken(upload.user_email);
              
              if (accessToken) {
                // نجحت المصادقة
                tokenError = null;
                break;
              } else {
                // فشل في الحصول على رمز
                tokenError = new Error('Failed to get valid access token for user');
              }
            } catch (err) {
              tokenError = err;
              console.error(`Authentication attempt ${attempt + 1} failed:`, err);
            }
            
            // انتظار قبل المحاولة التالية (زيادة الوقت تدريجياً: 1 ثانية، 2 ثانية، 4 ثانية)
            if (attempt < 2) {
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
          }
          
          // إذا فشلت جميع المحاولات
          if (!accessToken) {
            throw new Error(tokenError ? 
              `Authentication failed after multiple attempts: ${tokenError.message}` : 
              'Failed to get valid access token for user after multiple attempts');
          }
          
          // Initialize the OAuth2 client
          const oauth2Client = new google.auth.OAuth2();
          oauth2Client.setCredentials({
            access_token: accessToken,
          });
          
          // إضافة سجلات أكثر تفصيلاً للتشخيص
          console.log(`Successfully authenticated for user ${upload.user_email}, preparing for file upload`);
          
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
      message: `Processed ${allResults.length} of ${immediateFutureUploads.length} uploads for immediate processing`,
      processedCount: allResults.length,
      immediateUploads: immediateFutureUploads.length,
      futureUploads: farFutureUploads.length,
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