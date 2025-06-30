import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useUser } from './UserContext';
import { fetchJsonWithRetry, safeJsonParse } from '@/utils/apiHelpers';
import { isAuthenticationError, handleAuthError } from '@/utils/authHelpers';

// Create context
const MultiChannelContext = createContext();

// Add a client-side cache for channel info
const channelInfoCache = new Map(); // Key: accountId, Value: {data, timestamp}
const CHANNEL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache TTL (increased from 5)

// Add a log throttling mechanism with less frequent logging
const logTimestamps = new Map();
const LOG_THROTTLE_MS = 120000; // 2 minutes throttle time (increased from 1 minute)
const LOG_DEBUG = false; // Set to false to disable non-essential logs

// Helper function to throttled and conditional logging
const throttledLog = (message, accountId, forceLog = false) => {
  // Skip non-essential logs when debug mode is off
  if (!LOG_DEBUG && !forceLog) return;
  
  const key = `${message}-${accountId}`;
  const now = Date.now();
  const lastLog = logTimestamps.get(key) || 0;
  
  if (now - lastLog > LOG_THROTTLE_MS || forceLog) {
    console.log(message, accountId);
    logTimestamps.set(key, now);
  }
};

export function MultiChannelProvider({ children }) {
  const [channelsInfo, setChannelsInfo] = useState({});
  const [loadingChannels, setLoadingChannels] = useState({});
  const [errors, setErrors] = useState({});
  const { accounts } = useUser();

  // Minimum interval between fetches per account (10 minutes - increased from 5)
  const MIN_FETCH_INTERVAL = 10 * 60 * 1000;
  const lastFetchedRef = useRef({});
  // Track pending fetch promises to avoid duplicate requests
  const pendingFetches = useRef(new Map());

  // Fetch channel info for a specific account
  const fetchChannelInfo = useCallback(async (accountId, force = false) => {
    if (!accountId) return;

    // If a fetch is already in progress for this account, return the same promise
    if (!force && pendingFetches.current.has(accountId)) {
      return pendingFetches.current.get(accountId);
    }

    // Check cache first if not forcing refresh
    if (!force) {
      const cachedData = channelInfoCache.get(accountId);
      if (cachedData && (Date.now() - cachedData.timestamp) < CHANNEL_CACHE_TTL) {
        // Silently use cache without logging every use
        
        // Update state with cached data
        if (cachedData.data.success && cachedData.data.channelInfo) {
          setChannelsInfo(prev => ({ 
            ...prev, 
            [accountId]: {
              ...cachedData.data.channelInfo,
              status: cachedData.data.status,
              lastUpdated: cachedData.timestamp,
              fromCache: true
            }
          }));
        }
        
        return cachedData.data;
      }
    }

    // Throttle repeated calls unless force is true
    const lastFetched = lastFetchedRef.current[accountId] || 0;
    if (!force && Date.now() - lastFetched < MIN_FETCH_INTERVAL) {
      return;
    }

    // Mark the start time immediately to avoid parallel throttled calls
    lastFetchedRef.current[accountId] = Date.now();

    setLoadingChannels(prev => ({ ...prev, [accountId]: true }));
    setErrors(prev => ({ ...prev, [accountId]: null }));

    const fetchPromise = (async () => {
      try {
        throttledLog(`Fetching channel info for account:`, accountId, true);
        
        // Use the enhanced fetchJsonWithRetry function
        const data = await fetchJsonWithRetry(
          `/api/youtube/account-channel-info?accountId=${accountId}`,
          {
            method: 'GET',
            timeout: 60000, // 1 minute timeout for development
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            retryOnNetworkError: true,
          }
        );
        
        throttledLog(`Channel info response for account ${accountId}:`, data, true);
        console.log(`[MultiChannelContext] Full channelInfo object for ${accountId}:`, data.channelInfo);
        
        // Check if we got an HTML response (authentication issue)
        if (data.isHtmlResponse) {
          setErrors(prev => ({ 
            ...prev, 
            [accountId]: 'Authentication required. Please sign in again.' 
          }));
          return data;
        }
        
        // Store in cache
        channelInfoCache.set(accountId, {
          data,
          timestamp: Date.now()
        });
        
        if (data.success && data.channelInfo) {
          // Restructure channelInfo to match YouTube API response format expected by ChannelCard
          const transformedChannelInfo = {
            id: data.channelInfo.channelId, // Map channelId to id
            snippet: {
              title: data.channelInfo.channelTitle,
              description: data.channelInfo.description || '',
              customUrl: data.channelInfo.customUrl,
              publishedAt: data.channelInfo.publishedAt,
              thumbnails: {
                default: { url: data.channelInfo.thumbnailUrl || '', width: 88, height: 88 },
                medium: { url: data.channelInfo.thumbnailUrl || '', width: 240, height: 240 },
                high: { url: data.channelInfo.thumbnailUrl || '', width: 800, height: 800 },
              },
            },
            statistics: {
              viewCount: data.channelInfo.viewCount || '0',
              subscriberCount: data.channelInfo.subscriberCount || '0',
              videoCount: data.channelInfo.videoCount || '0',
            },
            status: data.status, // Add status directly to the top level for StatusIndicator
            lastUpdated: new Date().toISOString(),
          };

          setChannelsInfo(prev => ({ 
            ...prev, 
            [accountId]: transformedChannelInfo // Use the transformed object
          }));
        } else {
          // Clear existing data if the request was successful but returned no channel info
          setChannelsInfo(prev => ({
            ...prev,
            [accountId]: null
          }));
          
          // Set error if available
          if (data.message) {
            setErrors(prev => ({ ...prev, [accountId]: data.message }));
          }
        }
        
        return data;
      } catch (error) {
        console.error(`Error fetching channel info for account ${accountId}:`, error);
        
        // Handle authentication errors specially
        if (isAuthenticationError(error)) {
          console.log('[MultiChannel] Authentication error detected, handling...');
          
          // Check if it's a token-related error
          const isTokenError = error.message?.includes('token') || 
                              error.message?.includes('credentials') ||
                              error.message?.includes('access_token') ||
                              error.message?.includes('refresh');
          
          const errorMessage = isTokenError 
            ? 'Your YouTube access has expired. Please reconnect your account.'
            : 'Authentication required. Please sign in again.';
          
          setErrors(prev => ({ 
            ...prev, 
            [accountId]: errorMessage
          }));
          
          // For token errors, don't try to handle auth error (which would sign out)
          // Instead, just return the error for the user to reconnect
          if (isTokenError) {
            return { 
              success: false, 
              error: errorMessage, 
              authError: true,
              needsReconnect: true 
            };
          }
          
          // For other auth errors, try to handle with retry
          try {
            await handleAuthError(error, async () => {
              // Retry the fetch after auth is fixed
              return await fetchChannelInfo(accountId, true);
            });
          } catch (authError) {
            console.log('[MultiChannel] Auth error handling failed:', authError.message);
          }
          
          return { success: false, error: 'Authentication required', authError: true };
        }
        
        setErrors(prev => ({ 
          ...prev, 
          [accountId]: error.message || 'An unexpected error occurred' 
        }));
        return { success: false, error: error.message };
      } finally {
        setLoadingChannels(prev => ({ ...prev, [accountId]: false }));
        // Clean up pending fetch map
        pendingFetches.current.delete(accountId);
      }
    })();
    
    // Store the promise for deduplication
    pendingFetches.current.set(accountId, fetchPromise);
    return fetchPromise;
  }, []);

  // Youtube video operations
  const fetchYouTubeVideos = useCallback(async (accountId, options = {}) => {
    if (!accountId) return { success: false, error: 'No account ID provided' };

    const fetchKey = `videos-${accountId}`;
    if (pendingFetches.current.has(fetchKey)) {
      return pendingFetches.current.get(fetchKey);
    }

    setLoadingChannels(prev => ({ ...prev, [accountId]: true }));

    const fetchPromise = (async () => {
      try {
        const params = new URLSearchParams({
          accountId,
          ...(options.pageToken && { pageToken: options.pageToken }),
          ...(options.maxResults && { maxResults: options.maxResults }),
        });

        const data = await fetchJsonWithRetry(`/api/youtube/videos?${params}`);

        if (data.error) {
          throw new Error(data.error || 'Failed to fetch videos');
        }

        setChannelsInfo(prev => ({
          ...prev,
          [accountId]: {
            ...prev[accountId],
            videos: data.items || [],
            nextPageToken: data.nextPageToken,
            totalResults: data.pageInfo?.totalResults
          }
        }));
        return { success: true, data };
      } catch (error) {
        setErrors(prev => ({ ...prev, [accountId]: error.message }));
        return { success: false, error: error.message };
      } finally {
        setLoadingChannels(prev => ({ ...prev, [accountId]: false }));
        pendingFetches.current.delete(fetchKey);
      }
    })();

    pendingFetches.current.set(fetchKey, fetchPromise);
    return fetchPromise;
  }, []);

  // Upload video to YouTube
  const uploadVideo = useCallback(async (accountId, videoData) => {
    if (!accountId) return { success: false, error: 'No account ID provided' };

    try {
      const data = await fetchJsonWithRetry('/api/youtube/upload', {
        method: 'POST',
        body: JSON.stringify({ accountId, ...videoData })
      });

      if (data.error) {
        throw new Error(data.error || 'Failed to upload video');
      }

      // Refresh channel info after successful upload
      fetchChannelInfo(accountId, true);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [fetchChannelInfo]);

  // Get channel status
  const getChannelStatus = useCallback(async (accountId) => {
    if (!accountId) return { success: false, error: 'No account ID provided' };

    try {
      const data = await fetchJsonWithRetry(`/api/youtube/connection-status?accountId=${accountId}`);
      
      return data.error ? 
        { success: false, error: data.error } :
        { success: true, status: data.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  // Fetch all channels when accounts change
  useEffect(() => {
    // Add a check to prevent excessive API calls
    if (!accounts || accounts.length === 0) return;
    
    // Use a debounce to prevent multiple calls in quick succession
    const fetchTimeout = setTimeout(() => {
      // Only fetch the first account immediately, delay others to prevent concurrent requests
      accounts.forEach((account, index) => {
        // Only fetch if we don't already have the info (more conservative)
        const accountId = account.id;
        const cachedData = channelInfoCache.get(accountId);
        const hasValidCache = cachedData && (Date.now() - cachedData.timestamp) < CHANNEL_CACHE_TTL;
        
        if (!hasValidCache) {
          // Stagger requests with 2-second intervals
          setTimeout(() => {
            fetchChannelInfo(accountId);
          }, index * 2000); 
        }
      });
    }, 1500); // 1.5 second delay
    
    return () => clearTimeout(fetchTimeout);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  // Function to refresh a specific channel
  const refreshChannel = (accountId, force = false) => {
    if (accountId) {
      fetchChannelInfo(accountId, force);
    }
  };

  // Function to refresh all channels
  const refreshAllChannels = (force = false) => {
    if (accounts && accounts.length > 0) {
      accounts.forEach(account => {
        fetchChannelInfo(account.id, force);
      });
    }
  };

  // Helper functions for context value (moved outside useMemo)
  const getChannelInfo = useCallback((accountId) => channelsInfo[accountId] || {}, [channelsInfo]);
  const isChannelLoading = useCallback((accountId) => loadingChannels[accountId] || false, [loadingChannels]);
  const getChannelError = useCallback((accountId) => errors[accountId] || null, [errors]);

  // Context value memoization
  const value = useMemo(() => ({
    channelsInfo,
    loadingChannels,
    errors,
    fetchChannelInfo,
    fetchYouTubeVideos,
    uploadVideo,
    getChannelStatus,
    refreshChannel,
    refreshAllChannels,
    getChannelInfo, // Reference the stable helper function
    isChannelLoading, // Reference the stable helper function
    getChannelError, // Reference the stable helper function
  }), [channelsInfo, loadingChannels, errors, fetchChannelInfo, fetchYouTubeVideos, uploadVideo, getChannelStatus, refreshChannel, refreshAllChannels, getChannelInfo, isChannelLoading, getChannelError]);

  return (
    <MultiChannelContext.Provider value={value}>
      {children}
    </MultiChannelContext.Provider>
  );
}

// Custom hook for accessing MultiChannelContext
export function useMultiChannel() {
  const context = useContext(MultiChannelContext);
  if (!context) {
    throw new Error('useMultiChannel must be used within a MultiChannelProvider');
  }
  return context;
}

export function useSingleChannel(accountId) {
  const context = useContext(MultiChannelContext);
  const singleChannelContext = useMemo(() => {
    if (!context || !accountId) return {};

    return {
      channelInfo: context.getChannelInfo(accountId),
      loading: context.isChannelLoading(accountId),
      error: context.getChannelError(accountId),
      fetchChannelInfo: (force = false) => context.fetchChannelInfo(accountId, force),
      fetchYouTubeVideos: (options = {}) => context.fetchYouTubeVideos(accountId, options),
      uploadVideo: (videoData) => context.uploadVideo(accountId, videoData),
      getChannelStatus: () => context.getChannelStatus(accountId),
      refreshChannel: (force = false) => context.refreshChannel(accountId, force),
    };
  }, [context, accountId]);

  return singleChannelContext;
}