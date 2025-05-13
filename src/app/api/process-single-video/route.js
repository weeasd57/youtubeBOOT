import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { getValidAccessToken } from '@/utils/refreshToken';

// إنشاء عميل Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// التحقق من المصادقة
function validateApiSecret(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.split(' ')[1];
  return token === process.env.CRON_API_KEY;
}

export async function POST(request) {
  // التحقق من المصادقة
  if (!validateApiSecret(request)) {
    return NextResponse.json({ error: 'غير مصرح به' }, { status: 401 });
  }
  
  try {
    const data = await request.json();
    const { videoId } = data;
    
    if (!videoId) {
      return NextResponse.json({ error: 'معرف الفيديو مطلوب' }, { status: 400 });
    }
    
    // استرجاع معلومات الفيديو
    const { data: video, error } = await supabase
      .from('video_queue')
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (error || !video) {
      return NextResponse.json({ 
        error: error ? error.message : 'الفيديو غير موجود' 
      }, { status: error ? 500 : 404 });
    }
    
    // الحصول على رمز الوصول
    const accessToken = await getValidAccessToken(video.user_email);
    
    if (!accessToken) {
      await supabase
        .from('video_queue')
        .update({
          status: 'failed',
          error_message: 'رمز الوصول غير صالح',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
      return NextResponse.json({ error: 'رمز الوصول غير صالح' }, { status: 401 });
    }
    
    // الحصول على معلومات المجلد
    const { data: userSettings } = await supabase
      .from('users')
      .select('drive_folder_id, folder_name')
      .eq('email', video.user_email)
      .single();
    
    const folderId = userSettings?.drive_folder_id;
    
    if (!folderId) {
      await supabase
        .from('video_queue')
        .update({
          status: 'failed',
          error_message: 'مجلد Drive غير متوفر',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
      return NextResponse.json({ error: 'مجلد Drive غير متوفر' }, { status: 400 });
    }
    
    // التحقق من وجود الفيديو في Drive
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth });
    
    const videoExists = await checkFileExistsInDrive(drive, folderId, video.video_id);
    
    if (videoExists.exists) {
      // الفيديو موجود بالفعل، تحديث السجل فقط
      await supabase
        .from('video_queue')
        .update({
          status: 'completed',
          drive_file_id: videoExists.fileId,
          web_view_link: videoExists.webViewLink,
          processing_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
      return NextResponse.json({
        success: true,
        message: 'الفيديو موجود بالفعل في Drive',
        videoId: videoId,
        fileId: videoExists.fileId
      });
    }
    
    // الحصول على رابط التنزيل
    const downloadUrl = video.download_url || await getDownloadLink(video.url);
    
    if (!downloadUrl) {
      await supabase
        .from('video_queue')
        .update({
          status: 'failed',
          error_message: 'تعذر الحصول على رابط التنزيل',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId);
      
      return NextResponse.json({ 
        error: 'تعذر الحصول على رابط التنزيل' 
      }, { status: 400 });
    }
    
    // تنزيل الفيديو
    const videoBuffer = await downloadVideo(downloadUrl);
    
    // إنشاء اسم ملف نظيف
    const cleanTitle = cleanFileName(video.title || 'TikTok Video');
    const fileName = `tiktok-${video.video_id || Date.now()}-${cleanTitle}.mp4`;
    
    // رفع الفيديو إلى Drive
    const uploadResult = await uploadToDrive(
      drive,
      folderId,
      videoBuffer,
      fileName,
      video.title || 'TikTok Video',
      video.description || ''
    );
    
    // تحديث حالة الفيديو إلى مكتمل
    await supabase
      .from('video_queue')
      .update({
        status: 'completed',
        drive_file_id: uploadResult.fileId,
        web_view_link: uploadResult.webViewLink,
        file_size: videoBuffer.byteLength,
        processing_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId);
    
    return NextResponse.json({
      success: true,
      message: 'تم معالجة الفيديو بنجاح',
      videoId: videoId,
      fileId: uploadResult.fileId
    });
  } catch (error) {
    console.error('خطأ في معالجة الفيديو:', error);
    
    try {
      const { videoId } = await request.json();
      if (videoId) {
        await supabase
          .from('video_queue')
          .update({
            status: 'failed',
            error_message: error.message || 'خطأ غير معروف',
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
      }
    } catch (e) {
      console.error('خطأ إضافي أثناء تحديث حالة الفشل:', e);
    }
    
    return NextResponse.json({
      success: false,
      error: error.message || 'خطأ في معالجة الفيديو'
    }, { status: 500 });
  }
}

// التحقق من وجود ملف
async function checkFileExistsInDrive(drive, folderId, videoId) {
  if (!videoId || !folderId) return { exists: false };
  
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and name contains 'tiktok-${videoId}' and trashed=false`,
      fields: 'files(id, name, webViewLink)',
      spaces: 'drive'
    });
    
    const files = response.data.files || [];
    
    if (files.length > 0) {
      return {
        exists: true,
        fileId: files[0].id,
        fileName: files[0].name,
        webViewLink: files[0].webViewLink
      };
    }
    
    return { exists: false };
  } catch (error) {
    console.error('خطأ في التحقق من وجود الملف:', error);
    return { exists: false };
  }
}

// تنزيل فيديو
async function downloadVideo(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`فشل تنزيل الفيديو: ${response.status}`);
    }
    
    return await response.arrayBuffer();
  } catch (error) {
    console.error('خطأ في تنزيل الفيديو:', error);
    throw error;
  }
}

// الحصول على رابط التنزيل
async function getDownloadLink(tiktokUrl) {
  try {
    // استخدام API الحالي لاستخراج رابط التنزيل
    const response = await fetch('/api/tiktok-download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: tiktokUrl }),
    });
    
    if (!response.ok) {
      console.error('فشل في الحصول على رابط التنزيل:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.downloadUrl;
  } catch (error) {
    console.error('خطأ في الحصول على رابط التنزيل:', error);
    return null;
  }
}

// تنظيف اسم الملف
function cleanFileName(title) {
  return title
    .replace(/#\w+/g, '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .substring(0, 50)
    .trim();
}

// رفع إلى Drive
async function uploadToDrive(drive, folderId, buffer, fileName, title, description) {
  try {
    const fileMetadata = {
      name: fileName,
      description: description,
      parents: [folderId]
    };
    
    const media = {
      mimeType: 'video/mp4',
      body: Buffer.from(buffer)
    };
    
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id,name,webViewLink'
    });
    
    return {
      fileId: response.data.id,
      fileName: response.data.name,
      webViewLink: response.data.webViewLink
    };
  } catch (error) {
    console.error('خطأ في رفع الملف إلى Drive:', error);
    throw error;
  }
} 