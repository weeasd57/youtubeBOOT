'use client';

import { useEffect, useState, useCallback } from 'react';
import { useYouTube } from '@/contexts/YouTubeContext';
import { useYouTubeChannel } from '@/contexts/YouTubeChannelContext';
import { useDrive } from '@/contexts/DriveContext';
import { useSession } from 'next-auth/react';

/**
 * Custom hook to manage data fetching across multiple contexts
 * Prevents unnecessary API calls and optimizes loading state
 */
export function useDataFetching() {
  const { data: session, status } = useSession();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingAny, setLoadingAny] = useState(false);
  const [errorAny, setErrorAny] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  
  // Get context values
  const { 
    loading: driveLoading, 
    error: driveError, 
    fetchDriveFiles,
    lastChecked: driveLastChecked
  } = useDrive();
  
  const { 
    loading: youtubeLoading, 
    error: youtubeError, 
    isQuotaError,
    refreshVideos 
  } = useYouTube();
  
  const {
    loading: channelLoading,
    error: channelError,
    refreshConnection
  } = useYouTubeChannel();
  
  // Track combined loading state
  useEffect(() => {
    setLoadingAny(driveLoading || youtubeLoading || channelLoading);
  }, [driveLoading, youtubeLoading, channelLoading]);
  
  // Track any errors
  useEffect(() => {
    // Prioritize non-quota errors
    if (driveError) {
      setErrorAny(driveError);
    } else if (channelError) {
      setErrorAny(channelError);
    } else if (youtubeError && !isQuotaError) {
      setErrorAny(youtubeError);
    } else if (youtubeError && isQuotaError) {
      setErrorAny(youtubeError);
    } else {
      setErrorAny(null);
    }
  }, [driveError, youtubeError, channelError, isQuotaError]);
  
  // Unified refresh function that refreshes all data sources
  const refreshAll = useCallback((force = false) => {
    if (status !== 'authenticated') return;
    
    fetchDriveFiles(force);
    refreshVideos(force);
    refreshConnection(force);
    setLastRefresh(new Date());
  }, [status, fetchDriveFiles, refreshVideos, refreshConnection]);
  
  // Initialize data on first load
  useEffect(() => {
    if (status === 'authenticated' && initialLoading) {
      // Initial data load - use cache if available
      refreshAll(false);
      setInitialLoading(false);
    }
  }, [status, initialLoading, refreshAll]);
  
  // When the session changes (user logs in/out), reset the loading state
  useEffect(() => {
    if (status === 'unauthenticated') {
      setInitialLoading(true);
    }
  }, [status]);
  
  return {
    loading: loadingAny,
    initialLoading,
    error: errorAny,
    isQuotaError,
    lastRefresh,
    refreshAll,
    // Individual refresh functions for specific updates
    refreshDrive: (force = false) => fetchDriveFiles(force),
    refreshYouTube: (force = false) => refreshVideos(force),
    refreshChannel: (force = false) => refreshConnection(force)
  };
} 