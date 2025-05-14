'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ReloadIcon, SearchIcon, ExternalLinkIcon, CheckCircleIcon, AlertCircleIcon, PlayIcon } from 'lucide-react';

// إنشاء عميل Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function QueueDataTable({ filterStatus }) {
  const { session } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // استرجاع بيانات الفيديو من Supabase
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        
        // التحقق مما إذا كان المستخدم مسؤولًا
        if (session?.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('email', session.user.email)
            .single();
          
          setIsAdmin(userData?.role === 'admin');
        }
        
        // بناء استعلام Supabase
        let query = supabase
          .from('video_queue')
          .select('*');
        
        // تطبيق التصفية حسب الحالة إذا تم تحديدها
        if (filterStatus) {
          query = query.eq('status', filterStatus);
        }
        
        // التصفية حسب المستخدم إذا لم يكن مسؤولًا
        if (!isAdmin && session?.user) {
          query = query.eq('user_email', session.user.email);
        }
        
        // ترتيب النتائج
        query = query.order('created_at', { ascending: false });
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        setVideos(data || []);
        setError(null);
      } catch (err) {
        console.error('خطأ في استرجاع بيانات الفيديو:', err);
        setError('تعذر تحميل بيانات الفيديو');
      } finally {
        setLoading(false);
      }
    };
    
    fetchVideos();
    
    // إعداد الاشتراك في التغييرات في الوقت الحقيقي
    const subscription = supabase
      .channel('video_queue_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'video_queue',
        filter: isAdmin 
          ? undefined 
          : session?.user 
            ? `user_email=eq.${session.user.email}` 
            : undefined
      }, () => {
        fetchVideos();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [filterStatus, session, isAdmin]);

  // تصفية الفيديوهات حسب مصطلح البحث
  const filteredVideos = videos.filter(video => 
    video.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.video_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.url?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // تنسيق التاريخ
  const formatDate = (dateString) => {
    if (!dateString) return 'غير متوفر';
    return new Date(dateString).toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // تنسيق الحجم الملف
  const formatFileSize = (bytes) => {
    if (!bytes) return 'غير معروف';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // معالجة تحديث الأولوية
  const handleUpdatePriority = async (id, newPriority) => {
    try {
      setActionLoading(id);
      
      const { error } = await supabase
        .from('video_queue')
        .update({ priority: newPriority })
        .eq('id', id);
      
      if (error) throw error;
    } catch (err) {
      console.error('خطأ في تحديث الأولوية:', err);
      alert('تعذر تحديث الأولوية');
    } finally {
      setActionLoading(null);
    }
  };

  // معالجة طلب إعادة المعالجة
  const handleReprocess = async (id) => {
    try {
      setActionLoading(id);
      
      const { error } = await supabase
        .from('video_queue')
        .update({
          status: 'pending',
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    } catch (err) {
      console.error('خطأ في إعادة المعالجة:', err);
      alert('تعذر إعادة معالجة الفيديو');
    } finally {
      setActionLoading(null);
    }
  };

  // معالجة معالجة فيديو واحد على الفور
  const handleProcessNow = async (id) => {
    try {
      setActionLoading(id);
      
      const response = await fetch('/api/process-single-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_SECRET}`
        },
        body: JSON.stringify({ videoId: id })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'فشل معالجة الفيديو');
      }
    } catch (err) {
      console.error('خطأ في معالجة الفيديو:', err);
      alert(`تعذر معالجة الفيديو: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // الحصول على لون الشارة حسب الحالة
  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // ترجمة حالة الفيديو
  const translateStatus = (status) => {
    switch (status) {
      case 'pending':
        return 'في الانتظار';
      case 'processing':
        return 'قيد المعالجة';
      case 'completed':
        return 'مكتمل';
      case 'failed':
        return 'فشل';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <ReloadIcon className="animate-spin mr-2" />
        <p>جاري تحميل البيانات...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-800 p-4 rounded-md">
        <p>{error}</p>
        <Button 
          variant="outline" 
          className="mt-2" 
          onClick={() => window.location.reload()}
        >
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-md shadow">
      <div className="p-4">
        {/* شريط البحث */}
        <div className="relative mb-4">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            placeholder="البحث عن الفيديوهات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-50"
          />
        </div>
        
        {/* عرض عدد النتائج */}
        <p className="text-sm text-gray-500 mb-2">
          عرض {filteredVideos.length} من {videos.length} فيديو
          {filterStatus ? ` (${translateStatus(filterStatus)})` : ''}
        </p>
        
        {filteredVideos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            لا توجد فيديوهات للعرض
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">الحالة</TableHead>
                  <TableHead>العنوان</TableHead>
                  <TableHead>معرف الفيديو</TableHead>
                  <TableHead>تاريخ الإضافة</TableHead>
                  <TableHead>آخر تحديث</TableHead>
                  <TableHead>حجم الملف</TableHead>
                  <TableHead>الأولوية</TableHead>
                  <TableHead className="text-left">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVideos.map((video) => (
                  <TableRow key={video.id}>
                    <TableCell>
                      <Badge className={`${getStatusBadgeStyle(video.status)} px-2 py-1`}>
                        {translateStatus(video.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium truncate max-w-[200px]" title={video.title}>
                      {video.title || 'بلا عنوان'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{video.video_id || 'غير متوفر'}</TableCell>
                    <TableCell className="text-sm">{formatDate(video.created_at)}</TableCell>
                    <TableCell className="text-sm">{formatDate(video.updated_at)}</TableCell>
                    <TableCell>{formatFileSize(video.file_size)}</TableCell>
                    <TableCell>
                      <select
                        className="border rounded p-1 text-sm bg-gray-50"
                        value={video.priority || 0}
                        onChange={(e) => handleUpdatePriority(video.id, parseInt(e.target.value))}
                        disabled={actionLoading === video.id}
                      >
                        <option value="0">عادي</option>
                        <option value="1">مرتفع</option>
                        <option value="2">عاجل</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {video.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReprocess(video.id)}
                            disabled={actionLoading === video.id}
                            title="إعادة المعالجة"
                          >
                            {actionLoading === video.id ? (
                              <ReloadIcon className="w-4 h-4 animate-spin" />
                            ) : (
                              <ReloadIcon className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        
                        {video.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleProcessNow(video.id)}
                            disabled={actionLoading === video.id}
                            title="معالجة الآن"
                          >
                            {actionLoading === video.id ? (
                              <ReloadIcon className="w-4 h-4 animate-spin" />
                            ) : (
                              <PlayIcon className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        
                        {video.web_view_link && (
                          <Button
                            size="sm"
                            variant="outline"
                            as="a"
                            href={video.web_view_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="عرض في Drive"
                          >
                            <ExternalLinkIcon className="w-4 h-4" />
                          </Button>
                        )}
                        
                        {video.error_message && (
                          <span
                            className="text-red-500 cursor-help"
                            title={video.error_message}
                          >
                            <AlertCircleIcon className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
} 