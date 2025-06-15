'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useYouTube } from '@/contexts/YouTubeContext';
import { useYouTubeChannel } from '@/contexts/YouTubeChannelContext';
import { useDrive } from '@/contexts/DriveContext';
import { useSession } from 'next-auth/react';
import { useAccounts } from '@/contexts/AccountContext';

/**
 * Custom hook to manage data fetching across multiple contexts
 * Prevents unnecessary API calls and optimizes loading state
 */
export function useDataFetching() {
  const { data: session, status } = useSession();
  const { activeAccount } = useAccounts();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingAny, setLoadingAny] = useState(false);
  const [errorAny, setErrorAny] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  
  // Ref to track if initial data fetch has occurred
  const hasFetchedInitialData = useRef(false);
  
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
  
  // Track previous activeAccount to detect changes
  const prevActiveAccountRef = useRef(activeAccount);
  
  // Initialize data on first load and handle activeAccount changes
  useEffect(() => {
    console.log('useDataFetching useEffect - status:', status, 'initialLoading:', initialLoading, 'activeAccount:', activeAccount);
    
    if (status === 'loading') {
      // If session is still loading, keep initialLoading true
      console.log('Session is still loading...');
      setInitialLoading(true);
      return;
    }

    if (status === 'unauthenticated') {
      // If user is not authenticated, initial loading is done (no data to load)
      console.log('User is unauthenticated, setting initialLoading to false');
      setInitialLoading(false);
      // Reset hasFetchedInitialData when unauthenticated to allow re-fetch on re-login
      hasFetchedInitialData.current = false;
      return;
    }

    // If status === 'authenticated'
    if (status === 'authenticated' && !hasFetchedInitialData.current) {
      console.log('Initial loading phase, activeAccount:', activeAccount);
      
      if (activeAccount) {
        // If there's an active account, start fetching data for the first time
        console.log('useDataFetching: Active account present and initial fetch not done, refreshing all data.');
        refreshAll(false); // Use cache if available for the first load
        hasFetchedInitialData.current = true; // Mark initial fetch as done
      } else {
        // If no active account, but session is authenticated, initial loading is considered done for now.
        console.log('useDataFetching: No active account, initial loading considered done for now.');
        setInitialLoading(false);
        hasFetchedInitialData.current = true; // Mark as done even if no account, to prevent re-running this block
      }
      // No need for timeout here, as we're controlling `hasFetchedInitialData`
      setInitialLoading(false);
      return;
    }
    
    // Handle activeAccount changes after initial load is definitively done
    const activeAccountChanged = prevActiveAccountRef.current?.id !== activeAccount?.id;
    if (status === 'authenticated' && activeAccountChanged && activeAccount) {
      console.log('Active account changed to:', activeAccount.id, 'refreshing data...');
      refreshAll(true); // Force refresh on account change
    }
    
    // Update the previous activeAccount ref only after all checks
    prevActiveAccountRef.current = activeAccount;
    

  }, [status, activeAccount, refreshAll]); // Removed initialLoading from dependencies
  
  // When the session changes (user logs out), reset the loading state
  useEffect(() => {
    if (status === 'unauthenticated') {
      setInitialLoading(true); // Reset for potential re-login
      hasFetchedInitialData.current = false; // Allow re-fetch on re-login
      // Optionally, clear any fetched data here if needed
      // e.g., by calling clear functions from contexts if they exist
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