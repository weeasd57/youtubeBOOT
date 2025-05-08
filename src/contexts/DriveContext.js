'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';

// Create context
const DriveContext = createContext(null);

// Static cache - persists between renders
let driveFilesCache = [];
const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
let cacheTimestamp = 0;
let lastRequestTimestamp = 0;
const MIN_REQUEST_INTERVAL = 30 * 1000; // 30 seconds between API calls

// Provider component
export function DriveProvider({ children }) {
  const { data: session, status, update: updateSession } = useSession();
  const [driveFiles, setDriveFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  // Helper to check if cache is valid
  const isCacheValid = useCallback(() => {
    return driveFilesCache.length > 0 && 
           cacheTimestamp > 0 && 
           (Date.now() - cacheTimestamp) < CACHE_EXPIRY_MS;
  }, []);

  // Helper to check if we should throttle requests
  const shouldThrottleRequest = useCallback((forceRefresh) => {
    return !forceRefresh && 
           (Date.now() - lastRequestTimestamp) < MIN_REQUEST_INTERVAL;
  }, []);

  // Function to refresh session tokens
  const refreshSessionTokens = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/refresh-session');
      const data = await response.json();

      if (data.success) {
        // Update session through next-auth
        await updateSession();
        return true;
      } else if (data.action === 'sign_out') {
        // Token refresh failed completely, sign out user
        await signOut({ redirect: true, callbackUrl: '/' });
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [updateSession]);

  // Fetch video files from Google Drive
  const fetchDriveFiles = useCallback(async (forceRefresh = false, retryAfterRefresh = true) => {
    if (status !== 'authenticated') {
      return;
    }

    // Use cache if valid and not forcing refresh
    if (!forceRefresh && isCacheValid()) {
      console.log('Using cached Drive files data');
      setDriveFiles(driveFilesCache);
      setLastChecked(new Date(cacheTimestamp));
      return;
    }

    // Throttle API requests if needed
    if (shouldThrottleRequest(forceRefresh)) {
      console.log('Throttling Drive API calls - too frequent');
      return;
    }

    // Update last request timestamp
    lastRequestTimestamp = Date.now();

    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching Drive files...');
      const response = await fetch('/api/drive');
      const data = await response.json();
      
      setLastChecked(new Date());
      
      if (response.ok) {
        const files = data.files || [];
        setDriveFiles(files);
        
        // Update cache
        driveFilesCache = files;
        cacheTimestamp = Date.now();
      } else if (response.status === 401 && retryAfterRefresh) {
        // Auth error, try to refresh the token and retry
        const refreshed = await refreshSessionTokens();
        if (refreshed) {
          // Retry the fetch with the new token but don't retry again to avoid loops
          return fetchDriveFiles(forceRefresh, false);
        } else {
          setError('Authentication error. Please sign in again.');
          
          // Keep using cached data if available
          if (driveFilesCache.length > 0) {
            setDriveFiles(driveFilesCache);
          }
        }
      } else {
        setError(`Failed to fetch Drive files: ${data.error}`);
        
        // Use cached data if available on error
        if (driveFilesCache.length > 0) {
          console.log('Using cached Drive files after API error');
          setDriveFiles(driveFilesCache);
        }
      }
    } catch (error) {
      console.error('Error fetching Drive files:', error);
      setError(`Error fetching Drive files: ${error.message}`);
      
      // Use cached data if available on error
      if (driveFilesCache.length > 0) {
        console.log('Using cached Drive files after fetch error');
        setDriveFiles(driveFilesCache);
      }
    } finally {
      setLoading(false);
    }
  }, [status, refreshSessionTokens, isCacheValid, shouldThrottleRequest]);

  // Select a file
  const selectFile = (file) => {
    setSelectedFile(file);
    return file;
  };

  // Clear selected file
  const clearSelectedFile = () => {
    setSelectedFile(null);
  };

  // Reset cache - useful for testing or when authentication changes
  const resetCache = useCallback(() => {
    driveFilesCache = [];
    cacheTimestamp = 0;
    lastRequestTimestamp = 0;
  }, []);

  // Handle session refresh when auth errors occur
  const handleAuthError = useCallback(async () => {
    const refreshed = await refreshSessionTokens();
    if (refreshed) {
      setError(null);
      return true;
    }
    return false;
  }, [refreshSessionTokens]);

  // Effect for initial data load when session changes
  useEffect(() => {
    if (status === 'authenticated') {
      // Use cache or fetch new data
      if (isCacheValid()) {
        console.log('Using cached Drive files on session change');
        setDriveFiles(driveFilesCache);
        setLastChecked(new Date(cacheTimestamp));
      } else {
        fetchDriveFiles();
      }
    } else if (status === 'unauthenticated') {
      // Clear cache when user is not authenticated
      resetCache();
    }
  }, [status, fetchDriveFiles, isCacheValid, resetCache]);

  const value = {
    driveFiles,
    selectedFile,
    loading,
    error,
    isRefreshing,
    lastChecked,
    fetchDriveFiles,
    selectFile,
    clearSelectedFile,
    handleAuthError,
    resetCache
  };

  return <DriveContext.Provider value={value}>{children}</DriveContext.Provider>;
}

// Custom hook for using the context
export function useDrive() {
  const context = useContext(DriveContext);
  if (context === null) {
    throw new Error('useDrive must be used within a DriveProvider');
  }
  return context;
} 