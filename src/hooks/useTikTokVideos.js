'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export function useTikTokVideos() {
  const { data: session } = useSession();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTikTokVideos = useCallback(async () => {
    if (!session?.user?.email) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // استخدام API route بدلاً من الاتصال المباشر بـ Supabase
      const response = await fetch(`/api/tiktok/videos?email=${encodeURIComponent(session.user.email)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch TikTok videos: ${response.status}`);
      }
      
      const data = await response.json();
      setVideos(data || []);
    } catch (err) {
      console.error('Error fetching TikTok videos:', err);
      setError(err.message || 'Failed to fetch TikTok videos');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchTikTokVideos();
    }
  }, [session?.user?.email, fetchTikTokVideos]);

  // وظيفة للحصول على بيانات TikTok لملف Drive محدد
  const getTikTokDataForDriveFile = useCallback((driveFileId) => {
    if (!driveFileId || videos.length === 0) return null;
    return videos.find(video => video.drive_file_id === driveFileId);
  }, [videos]);

  return {
    videos,
    loading,
    error,
    fetchTikTokVideos,
    getTikTokDataForDriveFile
  };
} 