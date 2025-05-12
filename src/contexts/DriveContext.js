'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { withAuthRetry, isAuthError } from '@/utils/apiHelpers';

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
      
      // Handle network errors in the fetch itself
      if (!response.ok) {
        const data = await response.json();
        
        // Check for force sign out due to too many failures
        if (data.forceSignOut || data.action === 'sign_out') {
          console.warn('Force sign out triggered due to token refresh failures');
          // Add a small delay to show the error message before signing out
          setTimeout(() => {
            signOut({ redirect: true, callbackUrl: '/' });
          }, 2000);
          
          // Check if this is an access_revoked case
          const isAccessRevoked = data.error && (
            data.error.includes('revoked') || 
            data.error.includes('expired')
          );
          
          setError({
            message: data.message || 'Too many authentication failures. Signing you out...',
            isNetworkError: false,
            forceSignOut: true,
            isAccessRevoked: isAccessRevoked
          });
          return false;
        }
        
        // Check for network error specific action
        if (data.action === 'retry_later') {
          setError({
            message: `${data.message || 'Network connectivity issue detected'} (Failure ${data.failureCount || 1}/${data.maxFailures || 5})`,
            isNetworkError: true,
            failureCount: data.failureCount,
            maxFailures: data.maxFailures
          });
          return false;
        }
        
        throw new Error(data.message || 'Failed to refresh session');
      }
      
      const data = await response.json();

      if (data.success) {
        // Update session through next-auth
        await updateSession();
        setError(null); // Clear any errors
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error refreshing session:', error);
      
      // Set appropriate error based on type
      const isNetworkErr = error.message && (
        error.message.includes('fetch') || 
        error.message.includes('network') || 
        error.message.includes('Failed to fetch') ||
        error.message.includes('timeout')
      );
      
      if (isNetworkErr) {
        setError({
          message: 'Network connectivity issue. Please check your connection.',
          isNetworkError: true
        });
      } else {
        setError({
          message: `Authentication error: ${error.message}`,
          isNetworkError: false
        });
      }
      
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [updateSession]);

  // Fetch video files from Google Drive
  const fetchDriveFiles = useCallback(async (forceRefresh = false) => {
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

    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching Drive files...');
      
      // Limit retries to 2 to prevent looping
      let retryCount = 0;
      const maxRetries = 1; // Just one retry to avoid loops
      
      // Use simple try/catch instead of withAuthRetry
      const response = await fetch('/api/drive');
      
      if (!response.ok) {
        // For auth errors, refresh token once
        if (response.status === 401) {
          console.log('Authentication error, attempting to refresh token...');
          const refreshed = await refreshSessionTokens();
          
          if (refreshed) {
            // Try one more time after refreshing
            const retryResponse = await fetch('/api/drive');
            
            if (!retryResponse.ok) {
              throw new Error(`API error after token refresh: ${retryResponse.status}`);
            }
            
            const data = await retryResponse.json();
            const files = data.files || [];
            
            // Update state and cache
            setDriveFiles(files);
            setLastChecked(new Date());
            driveFilesCache = files;
            cacheTimestamp = Date.now();
            setLoading(false);
            return;
          } else {
            throw new Error('Failed to refresh authentication token');
          }
        }
        
        // Handle other response errors
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.message || `API error: ${response.status}`);
        } catch (parseError) {
          throw new Error(`Failed to fetch Drive files: ${response.status}`);
        }
      }
      
      // Successful response
      const data = await response.json();
      const files = data.files || [];
      
      // Update state and cache
      setDriveFiles(files);
      setLastChecked(new Date());
      driveFilesCache = files;
      cacheTimestamp = Date.now();
    } catch (error) {
      console.error('Error fetching Drive files:', error);
      
      const errorMessage = error.message || 'Unknown error';
      const isAuthenticationError = errorMessage.includes('authentication') || 
                                  errorMessage.includes('auth') ||
                                  errorMessage.includes('401');
      
      // Set a user-friendly error message
      if (isAuthenticationError) {
        setError('Authentication error. Please try refreshing the page.');
      } else {
        setError(`Failed to fetch Drive files: ${errorMessage}`);
      }
      
      // Use cached data if available on error
      if (driveFilesCache.length > 0) {
        console.log('Using cached Drive files after API error');
        setDriveFiles(driveFilesCache);
      }
    } finally {
      setLoading(false);
    }
  }, [status, refreshSessionTokens, shouldThrottleRequest, isCacheValid]);

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