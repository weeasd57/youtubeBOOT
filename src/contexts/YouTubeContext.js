'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { withAuthRetry, isAuthError } from '@/utils/apiHelpers';

// Create context
const YouTubeContext = createContext(null);

// Static cache for videos - persists between renders
let videoCache = [];
const CACHE_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours
let cacheTimestamp = 0;

// For throttling API requests
let youtubeLastRequestTimestamp = 0;
const MIN_REQUEST_INTERVAL = 30 * 1000; // 30 seconds between API calls

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

  // Helper to check if we should throttle requests
  const shouldThrottleRequest = useCallback((forceRefresh) => {
    return !forceRefresh && 
           (Date.now() - youtubeLastRequestTimestamp) < MIN_REQUEST_INTERVAL;
  }, []);

  // Helper function to refresh session tokens
  const refreshSessionTokens = useCallback(async () => {
    try {
      console.log('YouTubeContext: Refreshing session tokens');
      const response = await fetch('/api/refresh-session');
      const data = await response.json();
      
      if (data.success) {
        console.log('YouTubeContext: Token refresh successful');
        return true;
      }
      return false;
    } catch (error) {
      console.error('YouTubeContext: Error refreshing session:', error);
      return false;
    }
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
    if (status !== 'authenticated') {
      return;
    }

    // Use cache if valid and not forcing refresh
    if (!forceRefresh && isCacheValid()) {
      console.log('Using cached YouTube videos data');
      setVideos(videoCache);
      return;
    }

    // Throttle API requests if needed
    if (shouldThrottleRequest(forceRefresh)) {
      console.log('Throttling YouTube API calls - too frequent');
      return;
    }

    // Update last request timestamp
    youtubeLastRequestTimestamp = Date.now();
    setLastFetchAttempt(Date.now());

    setLoading(true);
    setError(null);
    setErrorType(null);
    
    try {
      // Use the withAuthRetry function for automatic retries on auth errors
      await withAuthRetry(async () => {
        console.log('Fetching YouTube videos...');
        const response = await fetch('/api/youtube/videos');
        const data = await response.json();
        
        if (!response.ok) {
          // Handle quota errors specially
          if (data.isQuotaError) {
            console.warn('YouTube API quota exceeded');
            setErrorType('quota');
            setError(data.message || 'YouTube API quota exceeded. Some features may be limited.');
            
            // For quota errors, mark today as exceeded and use cached videos if available
            quotaExceededDate = new Date();
            setDailyQuotaExceeded(true);
            
            if (videoCache.length > 0) {
              console.log('Using cached videos due to quota error');
              setVideos(videoCache);
            }
            return; // Don't retry quota errors
          }
          
          // For auth errors, refresh token and throw to trigger retry
          if (response.status === 401) {
            // Try to refresh the token
            await refreshSessionTokens();
            throw new Error('Authentication error - retrying after token refresh');
          }
          
          // For other errors, throw to either retry or propagate
          throw new Error(data.error || data.message || 'Failed to fetch YouTube videos');
        }
        
        // Success case
        const fetchedVideos = data.videos || [];
        setVideos(fetchedVideos);
        
        // Update cache
        if (fetchedVideos.length > 0) {
          videoCache = fetchedVideos;
          cacheTimestamp = Date.now();
        }
      }, {
        // Only retry auth errors
        shouldRetry: (error) => isAuthError(error),
        onRetry: ({ error, retryCount, delay }) => {
          console.log(`Retrying YouTube videos fetch (#${retryCount}) after ${Math.round(delay/1000)}s - ${error.message}`);
          setError(`Refreshing connection... Retry attempt ${retryCount}`);
        }
      });
    } catch (error) {
      console.error('Error fetching YouTube videos:', error);
      setError(`Error fetching YouTube videos: ${error.message}`);
      setErrorType('general');
      
      // Use cached data if available on error
      if (videoCache.length > 0) {
        console.log('Using cached videos due to fetch error');
        setVideos(videoCache);
      }
    } finally {
      setLoading(false);
    }
  }, [status, isCacheValid, shouldThrottleRequest, refreshSessionTokens]);

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