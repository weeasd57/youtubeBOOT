'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

// Cache configuration
const CACHE_KEY = 'tiktokVideosCache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useTikTokVideos() {
  const { data: session } = useSession();
  const [videos, setVideos] = useState(() => {
    // Try to load from cache on initial mount
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            return data;
          }
        } catch (e) {
          // Invalid cache, ignore
        }
      }
    }
    return [];
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Refs for tracking mount state and preventing duplicate requests
  const mounted = useRef(false);
  const fetchingRef = useRef(false);
  const lastFetchRef = useRef(0);

  // Session check with minimal logging
  const checkSession = useCallback(() => {
    return session?.user?.email;
  }, [session]);

  const fetchTikTokVideos = useCallback(async (force = false) => {
    const email = checkSession();
    if (!email || fetchingRef.current) return;
    
    // Check cache/rate limit unless forced
    if (!force) {
      const now = Date.now();
      if (now - lastFetchRef.current < CACHE_TTL) {
        return;
      }
    }
    
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/tiktok/videos?email=${encodeURIComponent(email)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch TikTok videos: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Only update state if component is still mounted
      if (mounted.current) {
        setVideos(data || []);
        
        // Update cache
        if (typeof window !== 'undefined') {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data,
            timestamp: Date.now()
          }));
        }
      }
    } catch (err) {
      if (mounted.current) {
        setError(err.message || 'Failed to fetch TikTok videos');
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
      fetchingRef.current = false;
      lastFetchRef.current = Date.now();
    }
  }, [checkSession]);

  // Mount effect with cleanup
  useEffect(() => {
    mounted.current = true;
    
    const email = checkSession();
    if (email && videos.length === 0) {
      fetchTikTokVideos();
    }
    
    return () => {
      mounted.current = false;
    };
  }, [checkSession, fetchTikTokVideos, videos.length]);

  // Optimized lookup functions
  const getTikTokDataForDriveFile = useCallback((driveFileId) => {
    if (!driveFileId || videos.length === 0) return null;
    return videos.find(video => video.drive_file_id === driveFileId);
  }, [videos]);

  const getTikTokDataByVideoId = useCallback((videoId) => {
    if (!videoId || videos.length === 0) return null;
    const cleanVideoId = String(videoId).trim();
    return videos.find(video => String(video.video_id).trim() === cleanVideoId);
  }, [videos]);

  // Public API
  return {
    videos,
    loading,
    error,
    refresh: () => fetchTikTokVideos(true),
    getTikTokDataForDriveFile,
    getTikTokDataByVideoId
  };
}