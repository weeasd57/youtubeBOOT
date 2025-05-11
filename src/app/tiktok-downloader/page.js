'use client';

import { useState, useRef } from 'react';
import { FaFileUpload, FaDownload, FaSpinner, FaEye } from 'react-icons/fa';

// Añadir estilos para la animación shimmer
const shimmerAnimation = `
  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(200%);
    }
  }
  
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
`;

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
        return (
          <span className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300 rounded-full inline-flex items-center gap-1.5 font-medium border border-gray-200 dark:border-gray-600 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></span>
            في الانتظار
          </span>
        );
      case 'processing':
        return (
          <span className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-full inline-flex items-center gap-1.5 font-medium border border-blue-200 dark:border-blue-800 shadow-sm">
            <FaSpinner className="animate-spin" size={12} />
            قيد المعالجة
          </span>
        );
      case 'completed':
        return (
          <span className="px-3 py-1.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded-full inline-flex items-center gap-1.5 font-medium border border-green-200 dark:border-green-800 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            مكتمل
          </span>
        );
      case 'failed':
        return (
          <span className="px-3 py-1.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded-full inline-flex items-center gap-1.5 font-medium border border-red-200 dark:border-red-800 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            فشل
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen p-8 flex flex-col dark:bg-gray-900">
      {/* Añadir estilos personalizados */}
      <style dangerouslySetInnerHTML={{ __html: shimmerAnimation }} />
      
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
            <div className="w-full mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{progress}% completado</span>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{Math.round((progress / 100) * videos.length)}/{videos.length} videos</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden dark:bg-gray-700 shadow-inner">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 relative overflow-hidden transition-all duration-500 ease-out shadow-sm flex items-center justify-center"
                  style={{ width: `${progress}%` }}
                >
                  {progress > 10 && (
                    <div className="absolute inset-0 overflow-hidden">
                      <span className="absolute inset-0 bg-white/20 animate-pulse"></span>
                      <span className="absolute top-0 bottom-0 w-8 bg-white/30 -skew-x-30 animate-shimmer"></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentVideo && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/10 rounded-lg border border-blue-200 dark:border-blue-800/30 shadow-sm">
              <div className="flex items-center">
                <div className="mr-3 flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                    <FaSpinner className="animate-spin text-white" size={14} />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">جارِ معالجة:</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-200 font-bold truncate">{currentVideo.title}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {videos.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 overflow-hidden border border-gray-100 dark:border-gray-700 transition-all hover:shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full max-w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20">
                  <th className="px-6 py-4 text-right text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider rounded-tl-lg">الفيديو</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">الرابط</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">الحالة</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider rounded-tr-lg">إجراءات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 dark:bg-gray-800 dark:divide-gray-700">
                {videos.map((video, index) => (
                  <tr key={video.id} className={`transition-colors ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-blue-50/50 dark:bg-gray-800/80'} hover:bg-blue-100/50 dark:hover:bg-blue-900/20`}>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{video.title}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{video.url}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {getStatusBadge(video.status)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex flex-col md:flex-row gap-2 justify-end">
                        <button
                          onClick={() => downloadSingleVideo(video)}
                          disabled={video.status === 'processing' || loading}
                          className={`px-3 py-1.5 rounded-md flex items-center gap-1 transition-all ${
                            video.status === 'completed' 
                              ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 hover:scale-105' 
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 hover:scale-105'
                          } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                        >
                          <FaDownload size={12} />
                          تحميل
                        </button>
                        {video.status === 'failed' && (
                          <button
                            onClick={() => window.open(video.url, '_blank')}
                            className="px-3 py-1.5 rounded-md flex items-center gap-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 hover:scale-105 transition-all"
                          >
                            <FaEye size={12} />
                            فتح الأصلي
                          </button>
                        )}
                      </div>
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