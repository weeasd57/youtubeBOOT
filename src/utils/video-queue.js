import { createClient } from '@supabase/supabase-js';

// إنشاء عميل Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// إضافة فيديو إلى قائمة المعالجة
export async function queueTikTokVideo(userEmail, videoDetails) {
  try {
    // استخراج معرف الفيديو من URL
    const videoId = videoDetails.videoId || extractVideoIdFromUrl(videoDetails.url);
    
    const { data, error } = await supabase
      .from('video_queue')
      .insert([
        {
          user_email: userEmail,
          title: videoDetails.title || 'TikTok Video',
          url: videoDetails.url,
          download_url: videoDetails.downloadUrl || null,
          video_id: videoId,
          description: videoDetails.description || '',
          status: 'pending'
        }
      ])
      .select();
    
    if (error) throw error;
    
    return { success: true, videoId: data[0].id };
  } catch (error) {
    console.error('خطأ في إضافة الفيديو للمعالجة:', error);
    return { success: false, error: error.message };
  }
}

// الحصول على الفيديوهات في قائمة الانتظار للمستخدم
export async function getUserQueuedVideos(userEmail) {
  try {
    const { data, error } = await supabase
      .from('video_queue')
      .select('*')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return { success: true, videos: data };
  } catch (error) {
    console.error('خطأ في استرجاع الفيديوهات المنتظرة:', error);
    return { success: false, error: error.message };
  }
}

// إلغاء فيديو من قائمة الانتظار (يمكن فقط إلغاء الفيديوهات في حالة الانتظار)
export async function cancelQueuedVideo(videoId, userEmail) {
  try {
    const { error } = await supabase
      .from('video_queue')
      .delete()
      .eq('id', videoId)
      .eq('user_email', userEmail)
      .eq('status', 'pending');
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('خطأ في إلغاء الفيديو من قائمة الانتظار:', error);
    return { success: false, error: error.message };
  }
}

// استخراج معرف الفيديو من URL
export function extractVideoIdFromUrl(url) {
  if (!url) return null;
  
  const tiktokIdRegex = /\/video\/(\d+)|vm\.tiktok\.com\/(\w+)|tiktok\.com\/@[^\/]+\/video\/(\d+)/;
  const matches = url.match(tiktokIdRegex);
  if (matches) {
    return matches[1] || matches[2] || matches[3];
  }
  return null;
} 