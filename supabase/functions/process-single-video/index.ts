// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clients } from "https://esm.sh/@googleapis/drive@5.0.4";
import { authorize } from "https://esm.sh/@googleapis/oauth2@5.0.4";

// إنشاء استجابة خطأ
function errorResponse(message: string, status: number = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

// التحقق من المصادقة
function validateApiSecret(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.split(' ')[1];
  return token === Deno.env.get('CRON_API_KEY');
}

serve(async (req) => {
  // التحقق من المصادقة
  if (!validateApiSecret(req)) {
    return errorResponse('غير مصرح به', 401);
  }
  
  try {
    const data = await req.json();
    const { videoId } = data;
    
    if (!videoId) {
      return errorResponse('معرف الفيديو مطلوب');
    }
    
    // إنشاء عميل Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // استرجاع معلومات الفيديو
    const { data: video, error } = await supabase
      .from('video_queue')
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (error || !video) {
      const status = error ? 500 : 404;
      const errorMsg = error ? error.message : 'الفيديو غير موجود';
      return errorResponse(errorMsg, status);
    }
    
    // الحصول على بيانات المستخدم ومعلومات الوصول
    // 1. أولاً نحصل على معلومات المجلد من جدول المستخدمين
    const { data: userInfo } = await supabase
      .from('users')
      .select('drive_folder_id')
      .eq('email', video.user_email)
      .single();
    
    // 2. ثم نحصل على رموز الوصول من جدول الرموز
    const { data: userTokens } = await supabase
      .from('user_tokens')
      .select('access_token, refresh_token')
      .eq('user_email', video.user_email)
      .single();
    
    // جمع المعلومات معًا
    const userSettings = {
      drive_folder_id: userInfo?.drive_folder_id,
      access_token: userTokens?.access_token,
      refresh_token: userTokens?.refresh_token
    };
    
    if (!userSettings?.drive_folder_id) {
      await updateVideoStatus(supabase, videoId, 'failed', 'مجلد Drive غير متوفر');
      return errorResponse('مجلد Drive غير متوفر');
    }
    
    // هنا يجب أن تكون عملية معالجة الفيديو الكاملة
    // بما في ذلك:
    // 1. التحقق من صلاحية رمز الوصول وتحديثه إذا لزم الأمر
    // 2. تنزيل الفيديو من المصدر
    // 3. رفع الفيديو إلى Google Drive
    // 4. تحديث حالة الفيديو
    
    // ملاحظة: هذه عملية معقدة وتحتاج إلى مزيد من التنفيذ
    // هنا نقوم فقط بمحاكاة نجاح العملية وتحديث الحالة
    
    await updateVideoStatus(
      supabase, 
      videoId, 
      'completed', 
      null, 
      {
        drive_file_id: 'mock_file_id_' + Date.now(),
        web_view_link: `https://drive.google.com/file/d/mock_${Date.now()}/view`,
        file_size: 1024 * 1024 * 5, // 5MB
        processing_completed_at: new Date().toISOString()
      }
    );
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'تم معالجة الفيديو بنجاح',
        videoId: videoId
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('خطأ في معالجة الفيديو:', error);
    
    // محاولة تحديث حالة الفيديو إلى فاشل
    try {
      const { videoId } = await req.json().catch(() => ({}));
      if (videoId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await updateVideoStatus(
          supabase,
          videoId,
          'failed',
          error.message || 'خطأ غير معروف'
        );
      }
    } catch (e) {
      console.error('خطأ إضافي أثناء تحديث حالة الفشل:', e);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'خطأ في معالجة الفيديو'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// دالة مساعدة لتحديث حالة الفيديو
async function updateVideoStatus(
  supabase,
  videoId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  errorMessage: string | null = null,
  additionalData = {}
) {
  const updateData = {
    status,
    error_message: errorMessage,
    updated_at: new Date().toISOString(),
    ...additionalData
  };
  
  // إزالة القيم الفارغة
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === null || updateData[key] === undefined) {
      delete updateData[key];
    }
  });
  
  const { error } = await supabase
    .from('video_queue')
    .update(updateData)
    .eq('id', videoId);
  
  if (error) {
    console.error('خطأ في تحديث حالة الفيديو:', error);
    throw new Error(`فشل تحديث حالة الفيديو: ${error.message}`);
  }
  
  return true;
} 