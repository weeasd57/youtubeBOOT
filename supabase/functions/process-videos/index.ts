// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// تعيين حجم الدفعة = 8
const BATCH_SIZE = 8;

serve(async (req) => {
  try {
    // التحقق من المصادقة
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'غير مصرح به' }), 
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const token = authHeader.split(' ')[1];
    const API_KEY = Deno.env.get('CRON_API_KEY');
    
    if (token !== API_KEY) {
      return new Response(
        JSON.stringify({ error: 'رمز غير صالح' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // استخراج معلومات الطلب
    const { userEmail } = await req.json().catch(() => ({}));
    
    // إنشاء عميل Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // استرداد الفيديوهات المعلقة
    let query = supabase
      .from('video_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);
    
    // تصفية حسب البريد الإلكتروني للمستخدم إذا تم تحديده
    if (userEmail) {
      query = query.eq('user_email', userEmail);
    }
    
    const { data: pendingVideos, error } = await query;
    
    if (error) {
      console.error('خطأ في استرداد الفيديوهات المعلقة:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (!pendingVideos || pendingVideos.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'لا توجد فيديوهات في قائمة الانتظار'
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // تحديث حالة الفيديوهات إلى 'معالجة'
    const videoIds = pendingVideos.map(video => video.id);
    const { error: updateError } = await supabase
      .from('video_queue')
      .update({ 
        status: 'processing', 
        processing_started_at: new Date().toISOString() 
      })
      .in('id', videoIds);
    
    if (updateError) {
      console.error('خطأ في تحديث حالة الفيديوهات:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // معالجة كل فيديو (استدعاء API معالجة فيديو واحد)
    const processPromises = pendingVideos.map(async (video) => {
      try {
        const response = await fetch(`${Deno.env.get('API_URL')}/api/process-single-video`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
          },
          body: JSON.stringify({ videoId: video.id })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `فشل طلب المعالجة: ${response.status}`);
        }
        
        return { id: video.id, success: true };
      } catch (error) {
        console.error(`خطأ في معالجة الفيديو ${video.id}:`, error);
        
        // تحديث حالة الفيديو إلى فاشل
        await supabase
          .from('video_queue')
          .update({
            status: 'failed',
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', video.id);
        
        return { id: video.id, success: false, error: error.message };
      }
    });
    
    // انتظار اكتمال جميع عمليات المعالجة
    const results = await Promise.all(processPromises);
    
    // تحديث إحصائيات المعالجة
    const successCount = results.filter(r => r.success).length;
    const failCount = pendingVideos.length - successCount;
    
    const now = new Date().toISOString();
    await supabase
      .from('processing_stats')
      .upsert([
        {
          id: 'daily_stats',
          last_batch_processed_at: now,
          videos_processed_today: supabase.sql`coalesce(videos_processed_today, 0) + ${successCount}`,
          videos_failed_today: supabase.sql`coalesce(videos_failed_today, 0) + ${failCount}`,
          last_reset_date: supabase.sql`coalesce(last_reset_date, ${now}::date)`,
          updated_at: now
        }
      ], { onConflict: 'id' });
    
    // التحقق من تاريخ إعادة التعيين (في منتصف الليل)
    const { data: stats } = await supabase
      .from('processing_stats')
      .select('last_reset_date')
      .eq('id', 'daily_stats')
      .single();
    
    const today = new Date().toISOString().split('T')[0];
    
    // إعادة تعيين العدادات اليومية إذا كان يوم جديد
    if (stats?.last_reset_date && stats.last_reset_date !== today) {
      await supabase
        .from('processing_stats')
        .update({
          videos_processed_today: 0,
          videos_failed_today: 0,
          last_reset_date: today,
          updated_at: now
        })
        .eq('id', 'daily_stats');
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingVideos.length,
        successful: successCount,
        failed: failCount,
        videos: results
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('خطأ في معالجة دفعة الفيديوهات:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'خطأ غير معروف'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}); 