'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// Create context
const YouTubeContext = createContext(null);

// Static cache for videos - persists between renders
let videoCache = [];
const CACHE_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours
let cacheTimestamp = 0;

// Keep track of quota exceeded status
let quotaExceededDate = null;

// Helper to check if quota was exceeded today
function wasQuotaExceededToday() {
  if (!quotaExceededDate) return false;
  
  const today = new Date();
  const exceedDate = new Date(quotaExceededDate);
  
  return today.getDate() === exceedDate.getDate() && 
         today.getMonth() === exceedDate.getMonth() && 
         today.getFullYear() === exceedDate.getFullYear();
}

// Provider component
export function YouTubeProvider({ children }) {
  const { data: session, status } = useSession();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);
  const [lastFetchAttempt, setLastFetchAttempt] = useState(0);
  const [dailyQuotaExceeded, setDailyQuotaExceeded] = useState(wasQuotaExceededToday());

  // Helper to check if cache is valid
  const isCacheValid = useCallback(() => {
    return videoCache.length > 0 && 
           cacheTimestamp > 0 && 
           (Date.now() - cacheTimestamp) < CACHE_EXPIRY_MS;
  }, []);

  // Update local state based on quota exceeded status
  useEffect(() => {
    setDailyQuotaExceeded(wasQuotaExceededToday());
    
    // Check at midnight for quota reset
    const checkForNewDay = () => {
      if (wasQuotaExceededToday()) {
        // It's still the same day
        return;
      }
      
      // It's a new day, reset quota exceeded flag
      quotaExceededDate = null;
      setDailyQuotaExceeded(false);
    };
    
    // Run once at component mount
    checkForNewDay();
    
    // Set up interval to check daily at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 10, 0); // 10 seconds after midnight
    
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();
    
    // Set timeout for midnight check
    const midnightTimeout = setTimeout(() => {
      checkForNewDay();
      
      // After the first timeout, set up daily interval
      const dailyInterval = setInterval(checkForNewDay, 24 * 60 * 60 * 1000);
      
      // Clear interval on component unmount
      return () => clearInterval(dailyInterval);
    }, timeUntilMidnight);
    
    // Clear timeout on component unmount
    return () => clearTimeout(midnightTimeout);
  }, []);

  // Fetch YouTube videos
  const fetchYouTubeVideos = useCallback(async (forceRefresh = false) => {
    if (status !== 'authenticated' || !session?.user?.email) {
      return;
    }

    // Check if daily quota is already exceeded, use cache and don't attempt API call
    if (dailyQuotaExceeded && !forceRefresh) {
      console.log('Skipping YouTube API call - daily quota already exceeded');
      
      if (videoCache.length > 0) {
        console.log('Using cached videos due to daily quota limit');
        setVideos(videoCache);
      }
      
      // Set friendly quota error message
      setError('Daily YouTube API quota exceeded. Will automatically try again tomorrow.');
      setErrorType('quota');
      return;
    }

    // Avoid too frequent API calls
    const now = Date.now();
    const minTimeBetweenFetches = 10 * 1000; // 10 seconds
    if (!forceRefresh && now - lastFetchAttempt < minTimeBetweenFetches) {
      console.log('Throttling YouTube API calls - too frequent');
      return;
    }
    
    setLastFetchAttempt(now);

    // Check cache first if not forcing refresh
    if (!forceRefresh && isCacheValid()) {
      console.log('Using cached YouTube videos data');
      setVideos(videoCache);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setErrorType(null);
      
      const response = await fetch('/api/youtube/videos');
      const data = await response.json();
      
      if (response.ok) {
        const fetchedVideos = data.videos || [];
        setVideos(fetchedVideos);
        
        // Update cache if we have videos
        if (fetchedVideos.length > 0) {
          videoCache = fetchedVideos;
          cacheTimestamp = Date.now();
        }
      } else {
        // Check if it's a quota error
        const isQuotaError = 
          response.status === 429 || 
          data.isQuotaError === true ||
          data.error === 'YouTube API quota exceeded';
        
        // Set error message using the response data
        setError(data.message || `Failed to fetch YouTube videos: ${data.error}`);
        setErrorType(isQuotaError ? 'quota' : 'general');
        
        // For quota errors, mark today as exceeded and use cached videos if available
        if (isQuotaError) {
          console.log('Quota exceeded, marking for today');
          quotaExceededDate = new Date();
          setDailyQuotaExceeded(true);
          
          if (videoCache.length > 0) {
            console.log('Using cached videos due to quota error');
            setVideos(videoCache);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching YouTube videos:', error);
      setError(`Error fetching YouTube videos: ${error.message}`);
      setErrorType('general');
      
      // For any error, use cached data if available
      if (videoCache.length > 0) {
        console.log('Using cached videos due to fetch error');
        setVideos(videoCache);
      }
    } finally {
      setLoading(false);
    }
  }, [session, status, isCacheValid, lastFetchAttempt, dailyQuotaExceeded]);

  // Effect for initial data load when session changes
  useEffect(() => {
    if (session?.user?.email) {
      fetchYouTubeVideos();
    }
  }, [session, fetchYouTubeVideos]);

  // Clear cache when session changes
  useEffect(() => {
    if (!session) {
      videoCache = [];
      cacheTimestamp = 0;
    }
  }, [session]);

  const value = {
    videos,
    loading,
    error,
    errorType,
    isQuotaError: errorType === 'quota',
    dailyQuotaExceeded,
    refreshVideos: (force = false) => fetchYouTubeVideos(force),
    clearCache: () => {
      videoCache = [];
      cacheTimestamp = 0;
    },
    resetQuotaExceeded: () => {
      quotaExceededDate = null;
      setDailyQuotaExceeded(false);
    }
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