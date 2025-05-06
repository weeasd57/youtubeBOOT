'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// Create context
const YouTubeContext = createContext(null);

// Provider component
export function YouTubeProvider({ children }) {
  const { data: session, status } = useSession();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch YouTube videos
  const fetchYouTubeVideos = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.email) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/youtube/videos');
      const data = await response.json();
      
      if (response.ok) {
        setVideos(data.videos || []);
      } else {
        setError(`Failed to fetch YouTube videos: ${data.error}`);
      }
    } catch (error) {
      console.error('Error fetching YouTube videos:', error);
      setError(`Error fetching YouTube videos: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [session, status]);

  // Effect for initial data load when session changes
  useEffect(() => {
    if (session?.user?.email) {
      fetchYouTubeVideos();
    }
  }, [session, fetchYouTubeVideos]);

  const value = {
    videos,
    loading,
    error,
    refreshVideos: fetchYouTubeVideos,
  };

  return <YouTubeContext.Provider value={value}>{children}</YouTubeContext.Provider>;
}

// Custom hook for using the context
export function useYouTube() {
  const context = useContext(YouTubeContext);
  if (context === null) {
    throw new Error('useYouTube must be used within a YouTubeProvider');
  }
  return context;
} 