import { useState } from 'react';
import { queueTikTokVideo } from '@/utils/video-queue';
import { useSession } from 'next-auth/react';
import { FaPlus, FaSpinner } from 'react-icons/fa';

export default function QueueVideoButton({ video, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();
  
  const handleAddToQueue = async () => {
    if (!session?.user?.email) return;
    
    setLoading(true);
    try {
      const result = await queueTikTokVideo(session.user.email, {
        title: video.title,
        url: video.url,
        downloadUrl: video.downloadUrl,
        videoId: video.videoId,
        description: video.description || video.title
      });
      
      if (result.success && onSuccess) {
        onSuccess(result.videoId);
      }
    } catch (error) {
      console.error('خطأ في إضافة الفيديو للمعالجة:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <button
      onClick={handleAddToQueue}
      disabled={loading}
      className="px-3 py-1.5 rounded-md flex items-center gap-1 transition-all bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
    >
      {loading ? (
        <>
          <FaSpinner className="animate-spin" size={14} />
          جارِ الإضافة...
        </>
      ) : (
        <>
          <FaPlus size={14} />
          إضافة للمعالجة التلقائية
        </>
      )}
    </button>
  );
} 