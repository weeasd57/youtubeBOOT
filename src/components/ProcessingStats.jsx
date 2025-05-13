import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RefreshCw, Clock, CheckCircle, XCircle } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ProcessingStats() {
  const [stats, setStats] = useState({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    processedToday: 0,
    failedToday: 0,
    lastProcessed: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // استدعاء وظيفة تحديث الإحصائيات عند تحميل المكون
  useEffect(() => {
    fetchStats();
    
    // إعداد إستماع للتغييرات في الوقت الحقيقي
    const queueSubscription = supabase
      .channel('video_queue_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'video_queue' 
      }, () => {
        fetchStats();
      })
      .subscribe();
      
    const statsSubscription = supabase
      .channel('stats_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'processing_stats' 
      }, () => {
        fetchStats();
      })
      .subscribe();
    
    // إلغاء الاشتراك عند إزالة المكون
    return () => {
      supabase.removeChannel(queueSubscription);
      supabase.removeChannel(statsSubscription);
    };
  }, []);

  // وظيفة لاسترجاع الإحصائيات
  const fetchStats = async () => {
    try {
      setIsRefreshing(true);
      
      // استعلام عن عدد الفيديوهات حسب الحالة
      const { data: queueStats, error: queueError } = await supabase
        .from('video_queue')
        .select('status', { count: 'exact', head: true })
        .in('status', ['pending', 'processing', 'completed', 'failed']);
      
      if (queueError) throw queueError;
      
      // استعلام مفصل للحالات المختلفة
      const { data: pending } = await supabase
        .from('video_queue')
        .select('count', { count: 'exact', head: true })
        .eq('status', 'pending');
        
      const { data: processing } = await supabase
        .from('video_queue')
        .select('count', { count: 'exact', head: true })
        .eq('status', 'processing');
        
      const { data: completed } = await supabase
        .from('video_queue')
        .select('count', { count: 'exact', head: true })
        .eq('status', 'completed');
        
      const { data: failed } = await supabase
        .from('video_queue')
        .select('count', { count: 'exact', head: true })
        .eq('status', 'failed');
      
      // استرجاع آخر معالجة وإحصائيات المعالجة اليومية
      const { data: processingStats, error: statsError } = await supabase
        .from('processing_stats')
        .select('*')
        .eq('id', 'daily_stats')
        .single();
      
      if (statsError && statsError.code !== 'PGRST116') throw statsError;
      
      // استعلام عن آخر فيديو تم معالجته
      const { data: lastProcessed, error: lastError } = await supabase
        .from('video_queue')
        .select('title, updated_at')
        .in('status', ['completed', 'failed'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (lastError && lastError.code !== 'PGRST116') console.log(lastError);
      
      // تجميع الإحصائيات
      setStats({
        pending: pending?.count || 0,
        processing: processing?.count || 0,
        completed: completed?.count || 0,
        failed: failed?.count || 0,
        total: queueStats?.count || 0,
        processedToday: processingStats?.videos_processed_today || 0,
        failedToday: processingStats?.videos_failed_today || 0,
        lastProcessed: lastProcessed,
        lastBatchTime: processingStats?.last_batch_processed_at,
      });
      
      setError(null);
    } catch (err) {
      console.error('خطأ في استرجاع الإحصائيات:', err);
      setError('حدث خطأ أثناء تحميل الإحصائيات');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // تنسيق التاريخ
  const formatDateTime = (dateString) => {
    if (!dateString) return 'غير متوفر';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // وظيفة طلب معالجة فورية
  const triggerProcessing = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/trigger-processing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ manual: true }),
      });
      
      if (!response.ok) {
        throw new Error('فشل طلب المعالجة');
      }
      
      await fetchStats();
    } catch (err) {
      console.error('خطأ في طلب المعالجة:', err);
      setError('حدث خطأ أثناء طلب المعالجة');
    } finally {
      setIsRefreshing(false);
    }
  };

  // UI للتحميل
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center p-4">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span className="mr-2">جاري تحميل الإحصائيات...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl">إحصائيات معالجة الفيديوهات</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={fetchStats}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>تحديث الإحصائيات</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      
      <CardContent>
        {error && (
          <div className="bg-red-50 text-red-800 p-2 mb-4 rounded-md text-sm">
            {error}
          </div>
        )}
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-50 p-3 rounded-lg text-center">
            <p className="text-sm text-gray-500 mb-1">في الانتظار</p>
            <p className="text-2xl font-semibold">{stats.pending}</p>
          </div>
          
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <p className="text-sm text-blue-500 mb-1">قيد المعالجة</p>
            <p className="text-2xl font-semibold">{stats.processing}</p>
          </div>
          
          <div className="bg-green-50 p-3 rounded-lg text-center">
            <p className="text-sm text-green-500 mb-1">مكتمل</p>
            <p className="text-2xl font-semibold">{stats.completed}</p>
          </div>
          
          <div className="bg-red-50 p-3 rounded-lg text-center">
            <p className="text-sm text-red-500 mb-1">فشل</p>
            <p className="text-2xl font-semibold">{stats.failed}</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
          <div className="p-3 bg-gray-50 rounded-lg flex-1">
            <div className="flex items-center mb-2">
              <Clock className="w-4 h-4 mr-2 text-gray-500" />
              <p className="text-sm font-medium">آخر دفعة معالجة</p>
            </div>
            <p className="text-sm text-gray-600">
              {stats.lastBatchTime ? formatDateTime(stats.lastBatchTime) : 'لا توجد معالجة سابقة'}
            </p>
          </div>
          
          <div className="p-3 bg-gray-50 rounded-lg flex-1">
            <div className="flex items-center mb-2">
              <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
              <p className="text-sm font-medium">تمت معالجتها اليوم</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">{stats.processedToday}</p>
              <Badge variant="secondary" className="mr-0 ml-2">
                <XCircle className="w-3 h-3 mr-1" /> {stats.failedToday} فشل
              </Badge>
            </div>
          </div>
        </div>
        
        {stats.lastProcessed && (
          <div className="p-3 bg-gray-50 rounded-lg mb-4">
            <p className="text-sm font-medium mb-1">آخر فيديو تمت معالجته:</p>
            <p className="text-sm text-gray-600">{stats.lastProcessed.title || 'بلا عنوان'}</p>
            <p className="text-xs text-gray-500 mt-1">{formatDateTime(stats.lastProcessed.updated_at)}</p>
          </div>
        )}
        
        <div className="mt-4 flex justify-end">
          <Button
            onClick={triggerProcessing}
            disabled={isRefreshing || stats.pending === 0}
            className="gap-2"
          >
            {isRefreshing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            معالجة الآن
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 