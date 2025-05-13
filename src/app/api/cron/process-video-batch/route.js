import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateProcessingStats, resetDailyStatsIfNeeded } from '@/utils/stats-helpers';

// إنشاء عميل Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// التحقق من المصادقة - تحديث لدعم كل من header و query parameter
function validateAuthorization(request) {
  // التحقق من Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token === process.env.CRON_API_KEY) {
      return true;
    }
  }
  
  // التحقق من Query Parameter
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('apiKey');
  if (apiKey && apiKey === process.env.CRON_API_KEY) {
    return true;
  }
  
  return false;
}

export async function GET(request) {
  // التحقق من المصادقة
  if (!validateAuthorization(request)) {
    return NextResponse.json({ error: 'غير مصرح به' }, { status: 401 });
  }
  
  try {
    // استدعاء API معالجة الفيديوهات
    const response = await fetch(new URL('/api/process-videos', request.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_API_KEY}`
      },
      body: JSON.stringify({ batchSize: 8 })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({
        success: false,
        error: errorData.error || 'فشل في معالجة دفعة الفيديو',
        status: response.status
      }, { status: 500 });
    }
    
    const result = await response.json();
    
    // تحديث إحصائيات المعالجة باستخدام الوظيفة المساعدة
    const now = new Date().toISOString();
    await updateProcessingStats(supabase, {
      last_batch_processed_at: now,
      videos_processed_today: supabase.sql`coalesce(videos_processed_today, 0) + ${result.processed?.length || 0}`,
      videos_failed_today: supabase.sql`coalesce(videos_failed_today, 0) + ${result.failed?.length || 0}`,
      total_videos_processed: supabase.sql`coalesce(total_videos_processed, 0) + ${result.processed?.length || 0}`,
      total_videos_failed: supabase.sql`coalesce(total_videos_failed, 0) + ${result.failed?.length || 0}`,
      last_reset_date: supabase.sql`coalesce(last_reset_date, ${now}::date)`,
      updated_at: now
    });
    
    // التحقق من تاريخ إعادة التعيين (في منتصف الليل)
    await resetDailyStatsIfNeeded(supabase);
    
    return NextResponse.json({
      success: true,
      result: {
        processed: result.processed?.length || 0,
        failed: result.failed?.length || 0,
        skipped: result.skipped?.length || 0
      }
    });
  } catch (error) {
    console.error('خطأ في وظيفة Cron لمعالجة الفيديو:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'خطأ غير معروف في معالجة الفيديو'
    }, { status: 500 });
  }
} 