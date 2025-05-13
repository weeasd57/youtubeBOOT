// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    
    // إنشاء عميل Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // استدعاء API معالجة الفيديوهات
    const processVideosUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-videos`;
    
    const response = await fetch(processVideosUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ batchSize: 8 })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return new Response(
        JSON.stringify({
          success: false,
          error: errorData.error || 'فشل في معالجة دفعة الفيديو',
          status: response.status
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const result = await response.json();
    
    // تحديث إحصائيات المعالجة
    const now = new Date().toISOString();
    const { error: statsError } = await supabase
      .from('processing_stats')
      .upsert([
        {
          id: 'daily_stats',
          last_batch_processed_at: now,
          videos_processed_today: supabase.sql`coalesce(videos_processed_today, 0) + ${result.successful || 0}`,
          videos_failed_today: supabase.sql`coalesce(videos_failed_today, 0) + ${result.failed || 0}`,
          last_reset_date: supabase.sql`coalesce(last_reset_date, ${now}::date)`,
          updated_at: now
        }
      ], { onConflict: 'id' });
    
    if (statsError) {
      console.error('خطأ في تحديث إحصائيات المعالجة:', statsError);
    }
    
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
        result: {
          processed: result.processed || 0,
          successful: result.successful || 0,
          failed: result.failed || 0
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('خطأ في وظيفة Cron لمعالجة الفيديو:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'خطأ غير معروف في معالجة الفيديو'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}); 