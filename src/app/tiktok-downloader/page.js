'use client';

import { useState, useRef } from 'react';
import { FaFileUpload, FaDownload, FaSpinner, FaEye } from 'react-icons/fa';

export default function TikTokDownloader() {
  const [jsonData, setJsonData] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  // تحميل ملف JSON
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        setJsonData(data);
        
        // استخراج روابط الفيديوهات
        const extractedVideos = [];
        for (const item of data) {
          if (item.webVideoUrl || item.videoUrl) {
            extractedVideos.push({
              id: item.id || `video-${extractedVideos.length + 1}`,
              url: item.webVideoUrl || item.videoUrl,
              title: item.text || item.desc || `فيديو ${extractedVideos.length + 1}`,
              status: 'pending',
              downloadUrl: null
            });
          }
        }
        setVideos(extractedVideos);
      } catch (error) {
        console.error('خطأ في تحليل ملف JSON:', error);
        alert('حدث خطأ في تحليل الملف. تأكد من أنه ملف JSON صالح.');
      }
    };
    reader.readAsText(file);
  };

  // الحصول على رابط التحميل من SnaptTik
  const getDownloadLink = async (tiktokUrl) => {
    try {
      console.log('Requesting download link for:', tiktokUrl);
      
      const response = await fetch('/api/tiktok-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: tiktokUrl }),
      });

      if (!response.ok) {
        console.error('API response not ok:', response.status);
        
        // Si el servicio no funciona, prueba la descarga directa
        if (response.status === 404) {
          // Usar método alternativo - descarga directa
          return `/api/tiktok-direct-download?url=${encodeURIComponent(tiktokUrl)}`;
        }
        
        throw new Error(`فشل الطلب: ${response.status}`);
      }

      const data = await response.json();
      console.log('Got download URL:', data.downloadUrl);
      return data.downloadUrl;
    } catch (error) {
      console.error('Error getting download link:', error);
      throw error;
    }
  };

  // تحميل جميع الفيديوهات
  const downloadAllVideos = async () => {
    if (videos.length === 0) return;
    
    setLoading(true);
    setProgress(0);
    
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      setCurrentVideo(video);
      
      try {
        // تحديث حالة الفيديو إلى قيد المعالجة
        setVideos(prev => 
          prev.map(v => v.id === video.id ? { ...v, status: 'processing' } : v)
        );
        
        // الحصول على رابط التحميل
        const downloadUrl = await getDownloadLink(video.url);
        
        // تحديث حالة الفيديو إلى مكتمل
        setVideos(prev => 
          prev.map(v => v.id === video.id ? { ...v, status: 'completed', downloadUrl } : v)
        );
        
        // تحميل الفيديو تلقائيًا
        if (downloadUrl) {
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = `${video.title.replace(/[^\w\s]/gi, '')}.mp4`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (error) {
        // تحديث حالة الفيديو إلى فاشل
        setVideos(prev => 
          prev.map(v => v.id === video.id ? { ...v, status: 'failed', error: error.message } : v)
        );
      }
      
      // تحديث التقدم
      setProgress(Math.round(((i + 1) / videos.length) * 100));
      
      // تأخير لتجنب الحظر
      if (i < videos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    setLoading(false);
    setCurrentVideo(null);
  };

  // تحميل فيديو واحد
  const downloadSingleVideo = async (video) => {
    if (video.status === 'completed' && video.downloadUrl) {
      // إذا كان الفيديو مكتملاً بالفعل، قم بتحميله فقط
      try {
        const link = document.createElement('a');
        link.href = video.downloadUrl;
        link.download = `${video.title.replace(/[^\w\s]/gi, '')}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) {
        console.error('Error initiating download:', e);
        // Abrir en nueva pestaña como alternativa
        window.open(video.downloadUrl, '_blank');
      }
      return;
    }
    
    try {
      // تحديث حالة الفيديو إلى قيد المعالجة
      setVideos(prev => 
        prev.map(v => v.id === video.id ? { ...v, status: 'processing' } : v)
      );
      
      // الحصول على رابط التحميل
      const downloadUrl = await getDownloadLink(video.url);
      
      // تحديث حالة الفيديو إلى مكتمل
      setVideos(prev => 
        prev.map(v => v.id === video.id ? { ...v, status: 'completed', downloadUrl } : v)
      );
      
      // تحميل الفيديو تلقائيًا
      if (downloadUrl) {
        try {
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = `${video.title.replace(/[^\w\s]/gi, '')}.mp4`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch (e) {
          console.error('Error initiating download:', e);
          // Abrir en nueva pestaña como alternativa
          window.open(downloadUrl, '_blank');
        }
      }
    } catch (error) {
      // تحديث حالة الفيديو إلى فاشل
      setVideos(prev => 
        prev.map(v => v.id === video.id ? { 
          ...v, 
          status: 'failed', 
          error: error.message,
          downloadUrl: video.url // En caso de fallo, establecer la URL original para abrir directamente
        } : v)
      );
      
      // Mostrar un mensaje de error al usuario
      alert(`Error al procesar el video: ${error.message}\n\nPor favor, intenta abrir directamente el enlace de TikTok.`);
    }
  };

  // تقرير حالة الفيديو
  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs bg-gray-200 text-gray-800 rounded-full">في الانتظار</span>;
      case 'processing':
        return <span className="px-2 py-1 text-xs bg-blue-200 text-blue-800 rounded-full flex items-center"><FaSpinner className="animate-spin mr-1" /> قيد المعالجة</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-green-200 text-green-800 rounded-full">مكتمل</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs bg-red-200 text-red-800 rounded-full">فشل</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen p-8 flex flex-col dark:bg-gray-900">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold dark:text-white">تحميل فيديوهات TikTok</h1>
        <button
          onClick={() => fileInputRef.current.click()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2"
        >
          <FaFileUpload /> تحميل ملف JSON
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json"
            className="hidden"
          />
        </button>
      </header>

      {jsonData && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-medium dark:text-white">تم العثور على {videos.length} فيديو</h2>
            {videos.length > 0 && (
              <button
                onClick={downloadAllVideos}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <FaSpinner className="animate-spin" /> جارِ التحميل ({progress}%)
                  </>
                ) : (
                  <>
                    <FaDownload /> تحميل جميع الفيديوهات
                  </>
                )}
              </button>
            )}
          </div>

          {loading && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 dark:bg-gray-700">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}

          {currentVideo && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <p className="dark:text-white">جارِ معالجة: {currentVideo.title}</p>
            </div>
          )}
        </div>
      )}

      {videos.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">الفيديو</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">الرابط</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">الحالة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">إجراءات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                {videos.map((video) => (
                  <tr key={video.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{video.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{video.url}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {getStatusBadge(video.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => downloadSingleVideo(video)}
                        disabled={video.status === 'processing' || loading}
                        className={`px-3 py-1.5 rounded-md flex items-center gap-1 ${
                          video.status === 'completed' 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <FaDownload size={12} />
                        تحميل
                      </button>
                      {video.status === 'failed' && (
                        <button
                          onClick={() => window.open(video.url, '_blank')}
                          className="px-3 py-1.5 rounded-md flex items-center gap-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 mt-1"
                        >
                          <FaEye size={12} />
                          فتح الأصلي
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!jsonData && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center max-w-md">
            <FaFileUpload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">تحميل فيديوهات TikTok</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              قم بتحميل ملف JSON الذي يحتوي على روابط فيديوهات TikTok لتحميلها بدون علامة مائية.
            </p>
            <button
              onClick={() => fileInputRef.current.click()}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md inline-flex items-center gap-2"
            >
              <FaFileUpload /> تحميل ملف JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}