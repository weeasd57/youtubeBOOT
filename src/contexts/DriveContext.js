'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { fetchDriveFoldersWithCache } from '@/utils/driveHelpers';
import { useSession } from 'next-auth/react';
import { useAccounts } from '@/contexts/AccountContext';
import { supabase } from '@/utils/supabase';

// Constants
const FOLDER_FETCH_DEBOUNCE = 10000; // 10 seconds
const FOLDER_CACHE_TTL = 60000; // 1 minute
const FORCE_REFRESH_INTERVAL = 300000; // 5 minutes
const TOKEN_CACHE_TTL = 300000; // 5 minutes (increased from 1 minute)
const CHANNEL_INFO_CACHE_TTL = 600000; // 10 minutes (increased from 5 minutes)

// Cache management with TTL
const tokenCache = {
  data: new Map(),
  get: (accountId) => {
    const cached = tokenCache.data.get(accountId);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > TOKEN_CACHE_TTL) {
      tokenCache.data.delete(accountId);
      return null;
    }
    return cached.token;
  },
  set: (accountId, token) => {
    tokenCache.data.set(accountId, {
      token,
      timestamp: Date.now()
    });
  }
};

const channelInfoCache = {
  data: new Map(),
  get: (accountId) => {
    const cached = channelInfoCache.data.get(accountId);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > CHANNEL_INFO_CACHE_TTL) {
      channelInfoCache.data.delete(accountId);
      return null;
    }
    return cached.info;
  },
  set: (accountId, info) => {
    channelInfoCache.data.set(accountId, {
      info,
      timestamp: Date.now()
    });
  }
};

// Create context
const DriveContext = createContext(null);

// Provider component
export function DriveProvider({ children }) {
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveFolders, setDriveFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const { data: session } = useSession();
  const { activeAccount } = useAccounts();

  // Add a ref for pending API calls (general, not specific to folders)
  const pendingApiCalls = useRef(new Map());

  // Helper function to make API calls with deduplication
  const makeApiCall = useCallback(async (key, apiCall) => {
    if (pendingApiCalls.current.has(key)) {
      return pendingApiCalls.current.get(key);
    }

    const promise = apiCall();
    pendingApiCalls.current.set(key, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      pendingApiCalls.current.delete(key);
    }
  }, []);

  // getValidToken function removed as it is now server-side only

  // Enhanced channel info fetch
  const getChannelInfo = useCallback(async (accountId) => {
    if (!accountId) {
      console.warn("getChannelInfo: No account ID provided");
      return null;
    }

    // Check cache first
    const cachedInfo = channelInfoCache.data.get(accountId);
    if (cachedInfo) {
      console.log(`Using cached channel info for account ${accountId}`);
      return cachedInfo;
    }

    // Create new request
    const channelPromiseKey = `channel_${accountId}`;
    const channelPromise = makeApiCall(channelPromiseKey, async () => {
      try {
        console.log(`Fetching fresh channel info for account ${accountId}`);
        const response = await fetch(`/api/youtube/account-channel-info?accountId=${accountId}`);
        if (!response.ok) throw new Error('Failed to get channel info');
        const data = await response.json();
        channelInfoCache.data.set(accountId, data);
        return data;
      } finally {
        // makeApiCall handles removal from its pending requests map
      }
    });

    // makeApiCall handles storing the pending request
    return channelPromise;
  }, [makeApiCall]);

  // Enhanced fetchDriveFiles implementation with debouncing
  const fetchDriveFiles = useCallback(async () => {
    try {
      const accountId = activeAccount?.id;
      if (!accountId) {
        console.warn("fetchDriveFiles: No active account available.");
        setDriveFiles([]);
        setError("Please ensure you're logged in and have an active account selected.");
        return;
      }

      // Static reference to track pending file fetches
      if (!fetchDriveFiles.pendingFetches) {
        fetchDriveFiles.pendingFetches = new Map();
      }
      
      // Check if we already have a pending fetch for this account
      if (fetchDriveFiles.pendingFetches.has(accountId)) {
        console.log(`Using pending files fetch for account ${accountId}`);
        return fetchDriveFiles.pendingFetches.get(accountId);
      }

      setLoading(true);
      setError(null);

      // Create the fetch promise
      const fetchPromise = (async () => {
        try {
          // Make the API call without client-side token handling
          const apiKey = `files_${accountId}`;
          const filesPromise = makeApiCall(apiKey, async () => {
            console.log(`Fetching drive files for account ${accountId}`);
            const response = await fetch(`/api/drive/list-files?accountId=${accountId}`); // Pass accountId as query param
            
            if (!response.ok) {
              // Handle 401 specifically, clear cache if necessary
              if (response.status === 401) {
                tokenCache.data.delete(accountId); // Clear cache if unauthorized
                throw new Error("Authentication expired or invalid. Please re-authenticate.");
              }
              throw new Error(`Failed to fetch drive files: ${response.statusText}`);
            }
            
            return response.json();
          });

          const data = await filesPromise;
          setDriveFiles(data.files || []);
          setLastChecked(new Date());
          return data.files || [];
        } catch (error) {
          console.error("Error in fetchDriveFiles:", error);
          setError(getUserFriendlyErrorMessage(error));
          setDriveFiles([]);
          throw error;
        } finally {
          setLoading(false);
          // Remove from pending fetches
          fetchDriveFiles.pendingFetches.delete(accountId);
        }
      })();

      // Store the pending fetch
      fetchDriveFiles.pendingFetches.set(accountId, fetchPromise);
      return fetchPromise;
    } catch (error) {
      console.error("Unexpected error in fetchDriveFiles:", error);
      setLoading(false);
      setError(getUserFriendlyErrorMessage(error));
      setDriveFiles([]);
    }
  }, [activeAccount?.id, makeApiCall]);

  // Simplified fetchDriveFolders to use fetchDriveFoldersWithCache directly
  const fetchDriveFolders = useCallback(async (forceRefresh = false) => {
    const accountId = activeAccount?.id;

    if (!accountId) {
      console.log('No active account, skipping Drive folders fetch');
      setDriveFolders([]);
      setFoldersLoading(false);
      setError('No active account available, please connect an account first');
      return { success: false, error: 'No active account' };
    }

    setFoldersLoading(true);
    setError(null);

    try {
      console.log(`Fetching drive folders for account ${accountId}, forceRefresh: ${forceRefresh}`);
      const result = await fetchDriveFoldersWithCache({
        forceRefresh,
        accountId,
        setLoadingState: setFoldersLoading, // Pass state setters
        setFoldersState: setDriveFolders,   // Pass state setters
        onFolderCheck: (folders) => {
          if (selectedFolder) {
            const folderStillExists = folders.some(folder => folder.id === selectedFolder.id);
            if (!folderStillExists) {
              console.log(`Selected folder ${selectedFolder.id} no longer exists, resetting selection`);
              setSelectedFolder(null);
            }
          }
        }
      });

      return result;
    } catch (error) {
      console.error('Error fetching Drive folders:', error);
      setError(getUserFriendlyErrorMessage(error));
      return { success: false, error: error.message };
    } finally {
      setFoldersLoading(false);
    }
  }, [activeAccount?.id, selectedFolder?.id]);

  // Listen for account switching events
  useEffect(() => {
    const handleAccountSwitch = (e) => {
      if (e.key === 'accountSwitched' && e.newValue === 'true') {
        console.log('Account switch detected in DriveContext');
        
        // Clear current data and caches
        setDriveFiles([]);
        setDriveFolders([]);
        setSelectedFolder(null);
        setSelectedFile(null);
        
        // Clear caches
        tokenCache.data.clear();
        channelInfoCache.data.clear();
        
        // Clear localStorage flag
        localStorage.removeItem('accountSwitched');
        
        // Cleanup any pending API calls
        pendingApiCalls.current.clear();
        
        // Refresh data after a short delay
        setTimeout(() => {
          fetchDriveFiles();
          fetchDriveFolders(true); // Force refresh on account switch
        }, 500);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleAccountSwitch);
      return () => {
        window.removeEventListener('storage', handleAccountSwitch);
        pendingApiCalls.current.clear();
      };
    }
  }, [fetchDriveFiles, fetchDriveFolders]);

  // Handle account changes
  useEffect(() => {
    const accountId = activeAccount?.id;
    if (!accountId) {
      // Clear data and caches when no active account
      setDriveFiles([]);
      setDriveFolders([]);
      setSelectedFolder(null);
      setSelectedFile(null);
      setError('No active account available');
      tokenCache.data.clear();
      channelInfoCache.data.clear();
      pendingApiCalls.current.clear();
      return;
    }

    console.log('Active account changed, initializing data fetch');
    
    // Reset timing refs and clear caches (done implicitly by fetchDriveFoldersWithCache)
    tokenCache.data.clear();
    channelInfoCache.data.clear();
    
    // Cleanup any pending API calls
    pendingApiCalls.current.clear();
    
    // Clear previous data
    setDriveFiles([]);
    setDriveFolders([]);
    setError(null);
    
    // Start fresh fetch cycle
    fetchDriveFiles();
    fetchDriveFolders(true); // Force refresh on account change
  }, [activeAccount?.id, fetchDriveFiles, fetchDriveFolders]);

  // Periodically check if selected folder still exists - similar to TikTokContext
  useEffect(() => {
    if (!activeAccount || !selectedFolder) return;
    
    const checkInterval = 120 * 60 * 1000; // 120 دقيقة (2 ساعات)
    let intervalId;

    const checkFolderPeriodically = () => {
      const lastFolderCheck = localStorage.getItem('lastDriveFolderCheck');
      const currentTime = Date.now();
      const shouldFetch = !lastFolderCheck || (currentTime - parseInt(lastFolderCheck)) > checkInterval;

      if (shouldFetch) {
        console.log('Scheduled folder check after delay (from useEffect)');
        localStorage.setItem('lastDriveFolderCheck', currentTime.toString());
        fetchDriveFolders(false); // Do not force refresh, rely on cache in driveHelpers
      }
    };

    // Initial check after a delay to allow other components to mount
    const initialCheckTimeout = setTimeout(checkFolderPeriodically, 5000); // 5 seconds delay

    // Set up periodic check
    intervalId = setInterval(checkFolderPeriodically, checkInterval);
    
    return () => {
      clearTimeout(initialCheckTimeout);
      clearInterval(intervalId);
    };
  }, [activeAccount?.id, selectedFolder?.id, fetchDriveFolders]);

  // Function to select a file
  const selectFile = (file) => {
    setSelectedFile(file);
  };

  // Function to clear selected file
  const clearSelectedFile = () => {
    setSelectedFile(null);
  };

  // Function to select a folder
  const selectFolder = (folder) => {
    // Don't do anything if selecting the same folder
    if (selectedFolder && folder && selectedFolder.id === folder.id) {
      console.log('Same folder selected, skipping refresh');
      return;
    }
    
    // Store the previous folder ID for logging
    const prevFolderId = selectedFolder?.id;
    const newFolderId = folder?.id;
    
    console.log(`Changing selected folder from ${prevFolderId || 'none'} to ${newFolderId || 'none'}`);
    
    setSelectedFolder(folder);
    
    // Clear selected file when changing folders
    setSelectedFile(null);
    
    // Clear files to indicate loading
    setDriveFiles([]);
    
    // Fetch files for the selected folder with a small delay to avoid rapid consecutive calls
    if (folder) {
      // Use a debounced fetch to avoid multiple rapid calls
      // Removed selectFolder.timeout logic, rely on fetchDriveFoldersWithCache for debouncing
      console.log(`Fetching files for folder ${folder.id} after selection`);
      fetchDriveFiles();
    }
  };

  // Function to clear selected folder
  const clearSelectedFolder = () => {
    setSelectedFolder(null);
  };

  // Get user-friendly error message
  const getUserFriendlyErrorMessage = (error) => {
    if (!error) return 'Unknown error occurred';
    
    // Handle string error messages
    if (typeof error === 'string') {
      if (error.includes('User not authenticated')) {
        return 'You are not authenticated with Google Drive. Please sign in to connect your account.';
      }
      if (error.includes('Missing or insufficient permissions')) {
        return 'Insufficient permissions for Google Drive. Please review the granted permissions or reconnect your account.';
      }
      return error;
    }

    // Handle error objects
    if (error instanceof Error) {
      if (error.message.includes('User not authenticated')) {
        return 'You are not authenticated with Google Drive. Please sign in to connect your account.';
      }
      if (error.message.includes('Missing or insufficient permissions')) {
        return 'Insufficient permissions for Google Drive. Please review the granted permissions or reconnect your account.';
      }
      return error.message;
    }

    return 'An unknown error occurred while fetching Drive data.';
  };

  const value = {
    driveFiles,
    driveFolders,
    loading,
    foldersLoading,
    error,
    lastChecked,
    selectedFile,
    selectedFolder,
    fetchDriveFiles,
    fetchDriveFolders,
    getChannelInfo,
    selectFile: (file) => setSelectedFile(file),
    clearSelectedFile: () => setSelectedFile(null),
    selectFolder: (folder) => setSelectedFolder(folder),
    clearSelectedFolder: () => setSelectedFolder(null),
    getUserFriendlyErrorMessage
  };

  return <DriveContext.Provider value={value}>{children}</DriveContext.Provider>;
}

// Custom hook for using the context
export function useDrive() {
  const context = useContext(DriveContext);
  console.log('useDrive hook called, context:', context);
  
  if (context === null) {
    console.error('useDrive must be used within a DriveProvider');
    // Instead of throwing, return a mock context to prevent crashes
    return {
      driveFiles: [],
      driveFolders: [],
      loading: false,
      foldersLoading: false,
      error: 'Drive context not available',
      lastChecked: null,
      selectedFile: null,
      selectedFolder: null,
      fetchDriveFiles: async () => { console.warn('fetchDriveFiles called but DriveProvider is not available'); },
      fetchDriveFolders: async () => { console.warn('fetchDriveFolders called but DriveProvider is not available'); },
      selectFile: () => {},
      clearSelectedFile: () => {},
      selectFolder: () => {},
      clearSelectedFolder: () => {},
      getUserFriendlyErrorMessage: (error) => error?.message || 'Drive context not available'
    };
  }
  
  return context;
}