/**
 * وظائف مساعدة للتعامل مع جدول إحصائيات المعالجة
 * تتيح استخدام الإحصائيات بشكل آمن سواءً كان الجدول موجودًا أم لا
 */

/**
 * تحديث إحصائيات المعالجة بأمان
 * @param {object} supabase - عميل Supabase
 * @param {object} statsData - بيانات الإحصائيات للتحديث
 * @returns {Promise<object|null>} - النتيجة أو null في حالة الخطأ
 */
export async function updateProcessingStats(supabase, statsData) {
  if (!supabase) return null;
  
  try {
    // التحقق من وجود الجدول
    const { count, error: checkError } = await supabase
      .from('processing_stats')
      .select('id', { count: 'exact', head: true });
    
    // إذا كان الجدول غير موجود، نعيد قيمة فارغة ولا نسجل أي خطأ
    if (checkError) {
      console.log('جدول إحصائيات المعالجة غير موجود - يتم تخطي التحديث');
      return null;
    }
    
    // إذا كان الجدول موجودًا ولكن بدون سجلات، نقوم بإنشاء السجل الأولي
    if (count === 0) {
      await supabase
        .from('processing_stats')
        .insert({ id: 'daily_stats' });
    }
    
    // تحديث الإحصائيات
    const { data, error } = await supabase
      .from('processing_stats')
      .upsert({
        id: 'daily_stats',
        updated_at: new Date().toISOString(),
        ...statsData
      }, { onConflict: 'id' });
    
    if (error) throw error;
    return data;
  } catch (error) {
    // نتجاهل أخطاء عدم وجود الجدول لضمان استمرار العمل
    console.warn('خطأ في تحديث إحصائيات المعالجة:', error.message);
    return null;
  }
}

/**
 * قراءة إحصائيات المعالجة بأمان
 * @param {object} supabase - عميل Supabase
 * @returns {Promise<object|null>} - بيانات الإحصائيات أو قيم افتراضية
 */
export async function getProcessingStats(supabase) {
  if (!supabase) return getDefaultStats();
  
  try {
    // التحقق من وجود الجدول
    const { count, error: checkError } = await supabase
      .from('processing_stats')
      .select('id', { count: 'exact', head: true });
    
    // إذا كان الجدول غير موجود، نعيد قيمًا افتراضية
    if (checkError || count === 0) {
      return getDefaultStats();
    }
    
    // قراءة الإحصائيات
    const { data, error } = await supabase
      .from('processing_stats')
      .select('*')
      .eq('id', 'daily_stats')
      .single();
    
    if (error) throw error;
    return data || getDefaultStats();
  } catch (error) {
    console.warn('خطأ في قراءة إحصائيات المعالجة:', error.message);
    return getDefaultStats();
  }
}

/**
 * إعادة تعيين العدادات اليومية للإحصائيات إذا كان يوم جديد
 * @param {object} supabase - عميل Supabase
 * @returns {Promise<boolean>} - ما إذا تم إعادة التعيين أم لا
 */
export async function resetDailyStatsIfNeeded(supabase) {
  if (!supabase) return false;
  
  try {
    const { data: stats } = await getProcessingStats(supabase);
    if (!stats) return false;
    
    const today = new Date().toISOString().split('T')[0];
    
    // إذا كان تاريخ آخر إعادة تعيين ليس اليوم، نعيد تعيين العدادات
    if (stats.last_reset_date && stats.last_reset_date !== today) {
      await updateProcessingStats(supabase, {
        videos_processed_today: 0,
        videos_failed_today: 0,
        last_reset_date: today
      });
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn('خطأ في التحقق من إعادة تعيين الإحصائيات اليومية:', error.message);
    return false;
  }
}

/**
 * الحصول على قيم إحصائيات افتراضية
 * @returns {object} - قيم إحصائيات افتراضية
 */
function getDefaultStats() {
  return {
    id: 'daily_stats',
    videos_processed_today: 0,
    videos_failed_today: 0,
    total_videos_processed: 0,
    total_videos_failed: 0,
    last_batch_processed_at: null,
    last_manual_trigger: null,
    last_manual_trigger_by: null,
    last_reset_date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
} 