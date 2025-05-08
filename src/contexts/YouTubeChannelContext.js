'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// Create context
const YouTubeChannelContext = createContext(null);

// Static cache - persists between renders
let channelInfoCache = null;
const CACHE_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours
let cacheTimestamp = 0;

// Provider component
export function YouTubeChannelProvider({ children }) {
  const { data: session, status } = useSession();
  const [channelInfo, setChannelInfo] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [lastUpdateAttempt, setLastUpdateAttempt] = useState(0);
  
  // Helper to check if cache is valid
  const isCacheValid = useCallback(() => {
    return channelInfoCache !== null && 
           cacheTimestamp > 0 && 
           (Date.now() - cacheTimestamp) < CACHE_EXPIRY_MS;
  }, []);

  // Get connection status
  const getConnectionStatus = useCallback(async (forceRefresh = false) => {
    if (status !== 'authenticated' || !session?.accessToken) {
      setConnectionStatus('disconnected');
      return;
    }

    // Avoid too frequent API calls
    const now = Date.now();
    const minTimeBetweenFetches = 30 * 1000; // 30 seconds
    if (!forceRefresh && now - lastUpdateAttempt < minTimeBetweenFetches) {
      console.log('Throttling connection status API calls - too frequent');
      return;
    }
    
    setLastUpdateAttempt(now);

    // Check cache first if not forcing refresh
    if (!forceRefresh && isCacheValid()) {
      console.log('Using cached YouTube connection data');
      setChannelInfo(channelInfoCache);
      setConnectionStatus('connected');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching YouTube connection status...');
      const response = await fetch('/api/youtube/connection-status');
      const data = await response.json();
      
      setLastChecked(new Date());
      
      if (response.ok) {
        console.log('Connection status fetched successfully');
        setConnectionStatus('connected');
        setChannelInfo(data);
        
        // Update cache
        channelInfoCache = data;
        cacheTimestamp = Date.now();
      } else if (response.status === 401) {
        console.log('Connection expired');
        setConnectionStatus('expired');
        setError('Authentication expired. Please refresh your token.');
      } else {
        console.log('Connection error:', data.message || 'Unknown error');
        setConnectionStatus('error');
        setError(data.message || 'Error checking connection');
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setConnectionStatus('error');
      setError('Error checking connection: ' + error.message);
      
      // Use cached data if available on error
      if (channelInfoCache) {
        setChannelInfo(channelInfoCache);
      }
    } finally {
      setLoading(false);
    }
  }, [session, status, isCacheValid, lastUpdateAttempt]);

  // Check connection when session changes
  useEffect(() => {
    if (session?.accessToken) {
      // Let's check if we have valid cached data first
      if (isCacheValid()) {
        console.log('Using cached channel info on session change');
        setChannelInfo(channelInfoCache);
        setConnectionStatus('connected');
        setLastChecked(new Date(cacheTimestamp));
      } else {
        // Only fetch if cache is invalid
        getConnectionStatus();
      }
    } else {
      setConnectionStatus('disconnected');
    }
  }, [session, getConnectionStatus, isCacheValid]);

  // Handler for refresh button
  const refreshConnection = useCallback((force = false) => {
    return getConnectionStatus(force);
  }, [getConnectionStatus]);

  // Reset cache - useful when authentication changes
  const resetCache = useCallback(() => {
    channelInfoCache = null;
    cacheTimestamp = 0;
    setChannelInfo(null);
    setLastChecked(null);
  }, []);

  // Clear cache when session is lost
  useEffect(() => {
    if (!session) {
      resetCache();
    }
  }, [session, resetCache]);

  const value = {
    channelInfo,
    connectionStatus,
    lastChecked,
    loading,
    error,
    refreshConnection,
    resetCache
  };

  return <YouTubeChannelContext.Provider value={value}>{children}</YouTubeChannelContext.Provider>;
}

// Custom hook for using the context
export function useYouTubeChannel() {
  const context = useContext(YouTubeChannelContext);
  if (context === null) {
    throw new Error('useYouTubeChannel must be used within a YouTubeChannelProvider');
  }
  return context;
} 