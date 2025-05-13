import { useState, useEffect } from 'react';
import { getUserQueuedVideos, cancelQueuedVideo } from '@/utils/video-queue';
import { useSession } from 'next-auth/react';
import { FaSync, FaSpinner, FaTimes } from 'react-icons/fa';

export default function VideoQueueStatus() {
  const { data: session } = useSession();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  useEffect(() => {
    if (session?.user?.email) {
      loadVideos();
      
      // تحديث كل دقيقة
      const interval = setInterval(loadVideos, 60000);
      return () => clearInterval(interval);
    }
  }, [session]);
  
  const loadVideos = async () => {
    if (!session?.user?.email) return;
    
    setLoading(true);
    try {
      const result = await getUserQueuedVideos(session.user.email);
      if (result.success) {
        setVideos(result.videos);
      }
    } catch (error) {
      console.error('خطأ في تحميل الفيديوهات:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    await loadVideos();
    setRefreshing(false);
  };
  
  const handleCancel = async (videoId) => {
    if (!session?.user?.email) return;
    
    try {
      const result = await cancelQueuedVideo(videoId, session.user.email);
      if (result.success) {
        // تحديث القائمة
        setVideos(videos.filter(v => v.id !== videoId));
      }
    } catch (error) {
      console.error('خطأ في إلغاء الفيديو:', error);
    }
  };
  
  // تجميع الإحصائيات
  const pending = videos.filter(v => v.status === 'pending').length;
  const processing = videos.filter(v => v.status === 'processing').length;
  const completed = videos.filter(v => v.status === 'completed').length;
  const failed = videos.filter(v => v.status === 'failed').length;
  
  if (!session) {
    return null;
  }
  
  return (
    <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">قائمة معالجة الفيديوهات</h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-2 py-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-800/40 text-amber-700 dark:text-amber-400 rounded-md text-sm flex items-center gap-1"
        >
          {refreshing ? <FaSpinner className="animate-spin" size={14} /> : <FaSync size={14} />}
          تحديث
        </button>
      </div>
      
      {loading && videos.length === 0 ? (
        <div className="flex justify-center py-4">
          <FaSpinner className="animate-spin" size={24} />
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
          لا توجد فيديوهات في قائمة المعالجة
        </div>
      ) : (
        <>
          {/* الإحصائيات */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30">
              <div className="text-sm text-yellow-700 dark:text-yellow-400">في الانتظار</div>
              <div className="text-2xl font-semibold text-yellow-800 dark:text-yellow-300">{pending}</div>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30">
              <div className="text-sm text-blue-700 dark:text-blue-400">قيد المعالجة</div>
              <div className="text-2xl font-semibold text-blue-800 dark:text-blue-300">{processing}</div>
            </div>
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30">
              <div className="text-sm text-green-700 dark:text-green-400">مكتمل</div>
              <div className="text-2xl font-semibold text-green-800 dark:text-green-300">{completed}</div>
            </div>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
              <div className="text-sm text-red-700 dark:text-red-400">فشل</div>
              <div className="text-2xl font-semibold text-red-800 dark:text-red-300">{failed}</div>
            </div>
          </div>
          
          {/* قائمة الفيديوهات */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">الفيديو</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">الحالة</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">وقت الإضافة</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {videos.slice(0, 10).map(video => (
                  <tr key={video.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-4 py-3">
                      <div className="font-medium truncate max-w-xs">{video.title || 'فيديو بدون عنوان'}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{video.url}</div>
                    </td>
                    <td className="px-4 py-3">
                      {video.status === 'pending' && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs rounded-full">
                          في الانتظار
                        </span>
                      )}
                      {video.status === 'processing' && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs rounded-full inline-flex items-center">
                          <FaSpinner className="animate-spin mr-1" size={10} />
                          قيد المعالجة
                        </span>
                      )}
                      {video.status === 'completed' && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs rounded-full">
                          مكتمل
                        </span>
                      )}
                      {video.status === 'failed' && (
                        <div>
                          <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-xs rounded-full">
                            فشل
                          </span>
                          {video.error_message && (
                            <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                              {video.error_message.substring(0, 50)}
                              {video.error_message.length > 50 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(video.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {video.status === 'pending' && (
                        <button
                          onClick={() => handleCancel(video.id)}
                          className="p-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-800/40 text-red-700 dark:text-red-400 rounded"
                          title="إلغاء"
                        >
                          <FaTimes size={14} />
                        </button>
                      )}
                      {video.status === 'completed' && video.web_view_link && (
                        <a
                          href={video.web_view_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                        >
                          عرض في Drive
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {videos.length > 10 && (
              <div className="text-center mt-2 text-sm text-gray-500 dark:text-gray-400">
                + {videos.length - 10} فيديوهات أخرى
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
} 