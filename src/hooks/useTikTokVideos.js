'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export function useTikTokVideos() {
  const { data: session } = useSession();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // دالة للتحقق من صلاحية الدورة
  const checkSession = useCallback(() => {
    console.log("useTikTokVideos - Session check:", {
      loggedIn: !!session,
      email: session?.user?.email,
    });
    return session?.user?.email;
  }, [session]);

  const fetchTikTokVideos = useCallback(async () => {
    const email = checkSession();
    if (!email) {
      console.log("useTikTokVideos - No session email, skipping fetch");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`useTikTokVideos - Fetching TikTok videos for ${email}...`);
      
      // طباعة معلومات الاتصال
      console.log("useTikTokVideos - API URL:", `/api/tiktok/videos?email=${encodeURIComponent(email)}`);
      console.log("useTikTokVideos - Environment vars:", {
        supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      });
      
      // استخدام API route بدلاً من الاتصال المباشر بـ Supabase
      const response = await fetch(`/api/tiktok/videos?email=${encodeURIComponent(email)}`);
      
      console.log("useTikTokVideos - API response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch TikTok videos: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`useTikTokVideos - Fetched ${data?.length || 0} TikTok videos from API`);
      console.log("useTikTokVideos - Sample videos:", data?.slice(0, 2));
      setVideos(data || []);
    } catch (err) {
      console.error('useTikTokVideos - Error fetching TikTok videos:', err);
      setError(err.message || 'Failed to fetch TikTok videos');
    } finally {
      setLoading(false);
    }
  }, [checkSession]);

  useEffect(() => {
    console.log("useTikTokVideos - Component mounted");
    const email = checkSession();
    if (email) {
      console.log("useTikTokVideos - Initiating fetch on mount");
      fetchTikTokVideos();
    }
  }, [checkSession, fetchTikTokVideos]);

  // وظيفة للحصول على بيانات TikTok لملف Drive محدد
  const getTikTokDataForDriveFile = useCallback((driveFileId) => {
    if (!driveFileId || videos.length === 0) return null;
    
    // التحقق من معرّف الملف
    console.log(`useTikTokVideos - Searching for TikTok data with drive_file_id: ${driveFileId}`);
    const match = videos.find(video => video.drive_file_id === driveFileId);
    
    if (match) {
      console.log(`useTikTokVideos - Found TikTok data by drive_file_id: ${driveFileId}`, match);
    }
    
    return match;
  }, [videos]);

  // وظيفة محسنة للحصول على بيانات TikTok بواسطة معرف فيديو TikTok
  const getTikTokDataByVideoId = useCallback((videoId) => {
    if (!videoId || videos.length === 0) {
      console.log(`useTikTokVideos - Cannot search for video_id: ${videoId} - invalid ID or no videos loaded (${videos.length} videos)`);
      return null;
    }
    
    console.log(`useTikTokVideos - Searching for TikTok data with video_id: "${videoId}" (type: ${typeof videoId})`);
    console.log(`useTikTokVideos - Available video_ids (${videos.length}):`);
    // طباعة أول 5 معرفات فقط لتجنب تسجيل كمية كبيرة من البيانات
    const sampleVideoIds = videos.slice(0, 5).map(v => v.video_id);
    console.log("useTikTokVideos - Sample video_ids:", sampleVideoIds);
    
    // تنظيف المعرف للمقارنة (إزالة المسافات وضمان أنه نص)
    const cleanVideoId = String(videoId).trim();
    
    // 1. البحث عن مطابقة دقيقة
    let match = videos.find(video => {
      const dbVideoId = video.video_id ? String(video.video_id).trim() : null;
      const exactMatch = dbVideoId === cleanVideoId;
      if (exactMatch) console.log(`useTikTokVideos - Exact match found: "${dbVideoId}" = "${cleanVideoId}"`);
      return exactMatch;
    });
    
    // 2. إذا لم يتم العثور على مطابقة دقيقة، نبحث عن معرّف يحتوي على videoId
    if (!match) {
      match = videos.find(video => {
        if (!video.video_id) return false;
        const dbVideoId = String(video.video_id).trim();
        const containsMatch = dbVideoId.includes(cleanVideoId);
        if (containsMatch) console.log(`useTikTokVideos - Partial match found: "${dbVideoId}" contains "${cleanVideoId}"`);
        return containsMatch;
      });
    }
    
    // 3. إذا لم يتم العثور على مطابقة، نبحث عن videoId يحتوي على معرّف من البيانات
    if (!match) {
      match = videos.find(video => {
        if (!video.video_id) return false;
        const dbVideoId = String(video.video_id).trim();
        const containedInMatch = cleanVideoId.includes(dbVideoId);
        if (containedInMatch) console.log(`useTikTokVideos - Reverse match found: "${cleanVideoId}" contains "${dbVideoId}"`);
        return containedInMatch;
      });
    }
    
    if (match) {
      console.log(`useTikTokVideos - Found TikTok data by video_id: ${videoId}`, match);
    } else {
      console.log(`useTikTokVideos - No TikTok data found for video_id: ${videoId}`);
    }
    
    return match;
  }, [videos]);

  return {
    videos,
    loading,
    error,
    fetchTikTokVideos,
    getTikTokDataForDriveFile,
    getTikTokDataByVideoId
  };
} 