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
    
    // Check if either the API key or the authorization header matches the expected values
    const isAuthorized = (apiKey && apiKey === process.env.CRON_API_KEY) || 
                         (headerToken && (headerToken === process.env.CRON_API_KEY || headerToken === process.env.CRON_SECRET));
    
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
          // تحقق من وجود عنوان صالح وتوفير قيمة افتراضية إذا كان فارغا
          let videoTitle = upload.title || fileDetails.data.name || `Video Upload ${new Date().toISOString().split('T')[0]}`;
          
          // حفظ نسخة من العنوان الأصلي للرجوع إليها
          const originalTitle = videoTitle;
          
          // للتشخيص: سجل العنوان الأصلي
          console.log(`Original title before processing: "${originalTitle}"`);
          
          // تنظيف العنوان من أي أحرف غير صالحة
          videoTitle = videoTitle.trim()
            // استبدل أحرف التحكم (\u0000-\u001F) والأحرف غير المرئية (\u007F-\u009F)
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
            // استبدل الرموز الخاصة التي قد تسبب مشاكل في YouTube API
            .replace(/[<>:"\/\\|?*%&{}$~^]/g, ' ')
            // تحويل علامات الهاشتاج إلى شكل متوافق
            .replace(/(^|\s)#/g, '$1hashtag_')
            // تصحيح المسافات المتعددة
            .replace(/\s+/g, ' ');
          
          console.log(`Title after special character cleanup: "${videoTitle}"`);
          
          // معالجة خاصة للنص العربي
          // 1. التأكد من عدم وجود مشاكل مع ترتيب النص واتجاهه
          // 2. إضافة مسافة بين الكلمات العربية وعلامات الترقيم إذا لزم الأمر
          // 3. التأكد من أن الهاشتاج يعمل بشكل صحيح مع النص العربي
          
          // تحديد ما إذا كان العنوان يحتوي على نص عربي
          const containsArabic = /[\u0600-\u06FF]/.test(videoTitle);
          
          if (containsArabic) {
            console.log(`Title contains Arabic text: "${videoTitle}"`);
            
            // إضافة مسافة بعد علامات الترقيم لتحسين التوافق
            videoTitle = videoTitle
              .replace(/([،؛؟!])([^\s])/g, '$1 $2')
              // تأكد من وجود مسافة قبل الهاشتاج في النص العربي
              .replace(/([^\s])hashtag_/g, '$1 hashtag_')
              // استعادة علامات الهاشتاج الحقيقية
              .replace(/hashtag_/g, '#');
            
            console.log(`Arabic-optimized title: "${videoTitle}"`);
          } else {
            // استعادة علامات الهاشتاج الحقيقية للنص غير العربي
            videoTitle = videoTitle.replace(/hashtag_/g, '#');
          }
          
          // اختبار خاص للتأكد من صحة العنوان
          // اختبار خاص للتأكد من صحة العنوان مع النصوص العربية
          // YouTube API قد ترفض بعض أنماط النصوص العربية
          // إنشاء نسخة من العنوان يحتوي فقط على الأحرف المسموحة من وجهة نظر YouTube
          // a-z, A-Z, 0-9 والأحرف العربية وبعض الرموز المسموحة مثل !،. -_()[]
          const validCharsRegex = /^[a-zA-Z0-9\u0600-\u06FF\s!,.'\-_\(\)\[\]]+$/;
          
          if (!validCharsRegex.test(videoTitle)) {
            // إذا كان العنوان يحتوي على أحرف غير مسموحة
            // يمكننا إما تنظيفه أكثر أو استخدام عنوان بديل
            console.log(`Title contains potentially problematic characters: "${videoTitle}"`);
            
            // حفظ العنوان الأصلي للأرشفة
            const originalTitle = videoTitle;
            
            // إزالة أي شيء غير الأحرف العربية والإنجليزية والأرقام والمسافات
            videoTitle = videoTitle.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
            
            if (!videoTitle || videoTitle.trim() === '') {
              // إذا أصبح العنوان فارغًا بعد التنظيف، استخدم عنوانًا افتراضيًا
              videoTitle = `YouTube Video ${upload.id}`;
            }
            
            console.log(`Cleaned title: "${videoTitle}"`);
          }
          
          // التأكد من أن العنوان ليس فارغا بعد التنظيف
          if (!videoTitle || videoTitle.trim() === '') {
            videoTitle = `YouTube Short ${new Date().toISOString().split('T')[0]}`;
          }
          
          // إضافة علامة #Shorts إذا لم تكن موجودة - تأكد من أنها بالإنجليزية
          let formattedTitle;
          if (videoTitle.includes('#Shorts') || videoTitle.includes('#shorts')) {
            formattedTitle = videoTitle;
          } else {
            // حاول إضافة #Shorts في نهاية العنوان
            formattedTitle = `${videoTitle} #Shorts`;
          }
          
          // تأكد من أن العنوان ليس أطول من 100 حرف (حد YouTube API)
          if (formattedTitle.length > 100) {
            // إذا كان العنوان أطول من 100، قصه واحتفظ بـ #Shorts
            const maxLength = 93; // 100 - 7 (#Shorts)
            formattedTitle = `${videoTitle.substring(0, maxLength).trim()} #Shorts`;
          }
          
          // التأكد من أن الوصف ليس فارغا
          const videoDescription = (upload.description || `Video uploaded automatically on ${new Date().toISOString().split('T')[0]}`).trim();
          
          console.log(`Preparing to upload video with title: "${formattedTitle}"`);
          
          // إضافة تعليق في سجلات النظام يحتوي على صورة كاملة عن البيانات
          console.log(`Upload details: 
            ID: ${upload.id}
            Title: ${formattedTitle}
            File ID: ${upload.file_id}
            File Name: ${upload.file_name}
            User: ${upload.user_email}
          `);
          
          // Create the video resource
          const videoResource = {
            snippet: {
              title: formattedTitle.substring(0, 100), // YouTube يقبل فقط العناوين حتى 100 حرف
              description: videoDescription.substring(0, 5000), // تقييد الوصف إلى الحد الأقصى
              categoryId: '22', // People & Blogs category
              tags: ['shorts', 'tiktok'] // إضافة تاجات افتراضية للمساعدة في الاكتشاف
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
          
          // تصنيف الخطأ لتوفير رسائل خطأ أكثر وضوحا
          let errorMessage = error.message;
          let errorCategory = 'unknown';
          
          // سجل الخطأ الأصلي بالكامل للتشخيص
          console.error(`Original error for upload ${upload.id}: ${error.stack || error.message}`);
          
          // معالجة أخطاء YouTube API الشائعة
          if (errorMessage.includes('invalid or empty video title')) {
            errorMessage = 'العنوان غير صالح أو فارغ. سيتم استخدام عنوان افتراضي في المحاولة التالية.';
            errorCategory = 'title_invalid';
          } else if (errorMessage.includes('quota')) {
            errorMessage = 'تم تجاوز حصة YouTube API اليومية. يرجى المحاولة مرة أخرى غدا.';
            errorCategory = 'quota_exceeded';
          } else if (errorMessage.includes('forbidden') || errorMessage.includes('permission')) {
            errorMessage = 'خطأ في صلاحيات الوصول. يرجى التحقق من إعدادات المصادقة.';
            errorCategory = 'auth_error';
          } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
            errorMessage = 'خطأ في الاتصال الشبكي. سيتم إعادة المحاولة تلقائيا.';
            errorCategory = 'network_error';
          } else if (errorMessage.includes('file not found') || errorMessage.includes('File not found')) {
            errorMessage = 'الملف غير موجود في جوجل درايف. قد يكون تم حذفه أو نقله.';
            errorCategory = 'file_not_found';
          } else if (errorMessage.includes('format') || errorMessage.includes('codec') || errorMessage.includes('unsupported')) {
            errorMessage = 'تنسيق الملف غير مدعوم. يجب استخدام تنسيق فيديو متوافق مع YouTube.';
            errorCategory = 'format_error';
          } else if (errorMessage.includes('length') || errorMessage.includes('duration')) {
            errorMessage = 'مدة الفيديو غير مناسبة. تأكد من أن مدة الفيديو مناسبة للنشر على YouTube.';
            errorCategory = 'duration_error';
          } else if (errorMessage.includes('size')) {
            errorMessage = 'حجم الملف كبير جدًا. يرجى استخدام ملف أصغر.';
            errorCategory = 'size_error';
          } else if (errorMessage.includes('metadata') || errorMessage.includes('snippet')) {
            errorMessage = 'خطأ في بيانات الفيديو (العنوان، الوصف، إلخ). يرجى مراجعة البيانات.';
            errorCategory = 'metadata_error';
          }
          
          // سجل الخطأ المصنف للمساعدة في تحليل الأخطاء
          console.error(`Categorized error for upload ${upload.id}: ${errorCategory} - ${errorMessage}`);
          
          // تسجيل تفاصيل الفيديو التي فشلت
          console.error(`Failed upload details:
            ID: ${upload.id}
            File ID: ${upload.file_id}
            File Name: ${upload.file_name || 'unknown'}
            Title: ${upload.title || 'not provided'}
            User: ${upload.user_email}
            Scheduled Time: ${upload.scheduled_time}
            Error Category: ${errorCategory}
          `);
          
          // تحديد ما إذا كان يجب إعادة محاولة الرفع لاحقا
          const shouldRetry = 
            errorCategory === 'network_error' || 
            errorCategory === 'quota_exceeded' || 
            errorCategory === 'title_invalid' ||
            errorMessage.includes('timeout');
          
          // إذا كان الخطأ مرتبطًا بالعنوان، قم بتسجيل العنوان الأصلي للمساعدة في التشخيص
          if (errorCategory === 'title_invalid' || errorCategory === 'metadata_error') {
            console.error(`Original title that caused error: "${upload.title}"`);
            
            // محاولة إصلاح العنوان تلقائيًا للمحاولة التالية
            try {
              // حفظ نسخة من العنوان الأصلي لإضافتها للسجل
              const originalTitle = upload.title;
              
              // إنشاء عنوان بسيط يعمل بشكل مؤكد مع YouTube API
              const fixedTitle = `YouTube Video ${new Date().toISOString().split('T')[0]} - ${Math.floor(Math.random() * 1000)} #Shorts`;
              
              // تحديث العنوان في قاعدة البيانات لضمان نجاح المحاولة التالية
              await supabaseAdmin
                .from('scheduled_uploads')
                .update({
                  title: fixedTitle,
                  original_title: originalTitle, // حفظ العنوان الأصلي في حقل منفصل
                  title_fixed: true // علامة لتتبع أن العنوان تم إصلاحه تلقائيًا
                })
                .eq('id', upload.id);
                
              console.log(`Auto-fixed title for upload ${upload.id}. New title: "${fixedTitle}"`);
            } catch (titleFixError) {
              console.error(`Failed to auto-fix title: ${titleFixError.message}`);
            }
          }
          
          // تحديث حالة الرفع المجدول
          await supabaseAdmin
            .from('scheduled_uploads')
            .update({
              status: shouldRetry ? 'pending' : 'failed', // وضع العملية في قائمة الانتظار للمحاولة مرة أخرى إذا كان الخطأ مؤقتا
              error_message: errorMessage,
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
              error_message: errorMessage,
              created_at: new Date().toISOString()
            });
          
          allResults.push({
            id: upload.id,
            status: 'error',
            error: errorMessage,
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