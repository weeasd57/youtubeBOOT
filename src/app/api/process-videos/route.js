import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/options';

// تعيين حجم الدفعة = 8 كما طلبت
const BATCH_SIZE = 8;

// إنشاء عميل Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    // التحقق من المصادقة
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'غير مصرح به' }, { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    if (token !== process.env.CRON_API_KEY) {
      return NextResponse.json({ error: 'رمز غير صالح' }, { status: 401 });
    }

    // استرداد الفيديوهات المعلقة
    const { data: pendingVideos, error } = await supabase
      .from('video_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);
    
    if (error) {
      console.error('خطأ في استرداد الفيديوهات المعلقة:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!pendingVideos || pendingVideos.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'لا توجد فيديوهات في قائمة الانتظار'
      });
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
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    
    // معالجة كل فيديو على حدة (إرسال طلبات متوازية)
    const results = await Promise.all(
      pendingVideos.map(async (video) => {
        try {
          // استدعاء API لمعالجة فيديو واحد
          const response = await fetch(`${request.nextUrl.origin}/api/process-single-video`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.CRON_API_KEY}`
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
      })
    );
    
    const successCount = results.filter(r => r.success).length;
    
    return NextResponse.json({
      success: true,
      processed: pendingVideos.length,
      successful: successCount,
      failed: pendingVideos.length - successCount,
      videos: results
    });
  } catch (error) {
    console.error('خطأ في معالجة دفعة الفيديوهات:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 