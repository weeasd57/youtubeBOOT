import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/auth';
import { updateProcessingStats } from '@/utils/stats-helpers';

// إنشاء عميل Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// التحقق مما إذا كان يجب استخدام وظائف Edge Functions
const useEdgeFunctions = process.env.NEXT_PUBLIC_USE_EDGE_FUNCTIONS === 'true';

export async function POST(request) {
  try {
    // التحقق من المصادقة
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'غير مصرح به، يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }
    
    // التحقق من دور المستخدم
    const { data: userRole } = await supabase
      .from('users')
      .select('role')
      .eq('email', session.user.email)
      .single();
    
    // التحقق مما إذا كان المستخدم مسؤولًا
    const isAdmin = userRole?.role === 'admin';
    
    // لا يُسمح إلا للمسؤولين أو عند النقر على "معالجة الفيديوهات الخاصة بي"
    const { manual, userOnly } = await request.json();
    
    if (!isAdmin && !userOnly) {
      return NextResponse.json(
        { error: 'غير مصرح لك بتشغيل المعالجة للجميع' },
        { status: 403 }
      );
    }
    
    // تكوين طلب معالجة الفيديو
    const processingOptions = {
      batchSize: 8
    };
    
    // إذا كان المستخدم يرغب في معالجة فيديوهاته فقط
    if (userOnly) {
      processingOptions.userEmail = session.user.email;
    }
    
    let response;
    
    if (useEdgeFunctions) {
      // استخدام وظائف Edge Functions
      const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-videos`;
      
      response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_API_KEY}`
        },
        body: JSON.stringify(processingOptions)
      });
    } else {
      // استخدام واجهة API المحلية
      const apiUrl = new URL('/api/process-videos', request.url).toString();
      
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_API_KEY}`
        },
        body: JSON.stringify(processingOptions)
      });
    }
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'فشل في معالجة الفيديو');
    }
    
    const result = await response.json();
    
    // تحديث إحصائيات المعالجة للطلبات اليدوية
    if (manual) {
      const now = new Date().toISOString();
      await updateProcessingStats(supabase, {
        last_manual_trigger: now,
        last_manual_trigger_by: session.user.email,
        updated_at: now
      });
    }
    
    return NextResponse.json({
      success: true,
      message: userOnly 
        ? 'تم بدء معالجة الفيديوهات الخاصة بك' 
        : 'تم بدء معالجة دفعة الفيديو',
      result
    });
  } catch (error) {
    console.error('خطأ في تشغيل معالجة الفيديو:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'خطأ في تشغيل معالجة الفيديو'
    }, { status: 500 });
  }
} 