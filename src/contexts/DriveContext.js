'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { withAuthRetry, isAuthError } from '@/utils/apiHelpers';
import { fetchDriveFoldersWithCache } from '@/utils/driveHelpers';

// Create context
const DriveContext = createContext(null);

// Static cache - persists between renders
let driveFilesCache = [];
let driveFoldersCache = [];
const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
let cacheTimestamp = 0;
let folderCacheTimestamp = 0;
let lastRequestTimestamp = 0;
const MIN_REQUEST_INTERVAL = 30 * 1000; // 30 seconds between API calls
// Track removed files to properly filter them
let removedFileIds = new Set();

// Add this helper function at the file level to get user-friendly error messages
function getUserFriendlyErrorMessage(error) {
  if (!error) return 'Unknown error occurred';
  
  // Handle string error messages
  if (typeof error === 'string') {
    if (error.includes('500')) {
      return 'Google Drive server error. This is likely a temporary issue.';
    }
    if (error.includes('auth') || error.includes('401')) {
      return 'Your Google Drive authentication has expired. Please sign out and sign in again.';
    }
    return error;
  }

  // Handle error objects
  const errorMessage = error.message || '';
  
  if (errorMessage.includes('500') || errorMessage.includes('The server encountered an error')) {
    return 'Google Drive server error. This is likely a temporary issue.';
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
    return 'Network connection issue. Please check your internet connection.';
  }
  
  if (errorMessage.includes('auth') || errorMessage.includes('401')) {
    return 'Your Google Drive authentication has expired. Please sign out and sign in again.';
  }
  
  if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
    return 'Google Drive API quota exceeded. Please try again later.';
  }
  
  return errorMessage || 'Unknown error occurred';
}

// Provider component
export function DriveProvider({ children }) {
  const { data: session, status, update: updateSession } = useSession();
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveFolders, setDriveFolders] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  // Helper to check if cache is valid
  const isCacheValid = useCallback(() => {
    return driveFilesCache.length > 0 && 
           cacheTimestamp > 0 && 
           (Date.now() - cacheTimestamp) < CACHE_EXPIRY_MS;
  }, []);

  // Helper to check if folder cache is valid
  const isFolderCacheValid = useCallback(() => {
    return driveFoldersCache.length > 0 && 
           folderCacheTimestamp > 0 && 
           (Date.now() - folderCacheTimestamp) < CACHE_EXPIRY_MS;
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

    // Clear cache if force refreshing
    if (forceRefresh) {
      console.log('Force refreshing - clearing cache and removed file IDs');
      driveFilesCache = [];
      cacheTimestamp = 0;
      removedFileIds.clear();
    }

    // Use cache if valid and not forcing refresh
    if (!forceRefresh && isCacheValid()) {
      console.log('Using cached Drive files data');
      setDriveFiles(driveFilesCache);
      setLastChecked(new Date(cacheTimestamp));
      return;
    }

    // Throttle API requests if needed - but bypass if force refreshing
    if (!forceRefresh && shouldThrottleRequest(forceRefresh)) {
      console.log('Throttling Drive API calls - too frequent');
      return;
    }

    // Update last request timestamp
    lastRequestTimestamp = Date.now();

    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching Drive files and changes...');
      
      // First try the direct files API for reliability
      let files = [];
      let useChangesAPI = false;
      
      try {
        console.log('Trying direct drive-files API first...');
        const directResponse = await fetch('/api/drive-files');
        
        if (directResponse.ok) {
          const directData = await directResponse.json();
          if (directData.files && directData.files.length > 0) {
            console.log(`Found ${directData.files.length} files through direct API call`);
            files = directData.files;
          } else {
            console.log('No files found through direct API, falling back to changes API');
            useChangesAPI = true;
          }
        } else {
          console.log('Direct API call failed, falling back to changes API');
          useChangesAPI = true;
        }
      } catch (directError) {
        console.error('Error in direct files.list call:', directError);
        useChangesAPI = true;
      }
      
      // Fall back to changes API if direct API failed or returned no files
      if (useChangesAPI) {
        // Use the drive-changes API endpoint that tracks file changes
        const response = await fetch('/api/drive-changes');
        
        if (!response.ok) {
          // For auth errors, refresh token once
          if (response.status === 401) {
            console.log('Authentication error, attempting to refresh token...');
            const refreshed = await refreshSessionTokens();
            
            if (refreshed) {
              // Try one more time after refreshing
              const retryResponse = await fetch('/api/drive-changes');
              
              if (!retryResponse.ok) {
                throw new Error(`API error after token refresh: ${retryResponse.status}`);
              }
              
              const data = await retryResponse.json();
              
              // Update removedFileIds with any files that were deleted
              if (data.changes) {
                data.changes.forEach(change => {
                  if (change.removed) {
                    removedFileIds.add(change.fileId);
                    console.log(`File was removed: ${change.fileId}`);
                  }
                });
              }
              
              // Get the actual files list
              files = data.files || [];
              
              // If no files were found through the changes API, try a direct files.list call
              if (files.length === 0) {
                console.log('No files returned from changes API, trying direct files.list call again');
                try {
                  const directResponse = await fetch('/api/drive-files');
                  if (directResponse.ok) {
                    const directData = await directResponse.json();
                    if (directData.files && directData.files.length > 0) {
                      console.log(`Found ${directData.files.length} files through direct API call`);
                      files = directData.files;
                    }
                  }
                } catch (directError) {
                  console.error('Error in direct files.list call:', directError);
                  // Continue with empty files rather than failing
                }
              }
            } else {
              throw new Error('Failed to refresh authentication token');
            }
          } else {
            // Handle other response errors
            try {
              const errorData = await response.json();
              const errorMessage = errorData.error || errorData.message || `API error: ${response.status}`;
              console.error('Error fetching Drive files:', errorMessage);
              setError(errorMessage);
              
              // Use cached data if available on error
              if (driveFilesCache.length > 0) {
                console.log('Using cached Drive files after API error');
                setDriveFiles(driveFilesCache);
              }
              setLoading(false);
              return; // Return early instead of throwing
            } catch (parseError) {
              const errorMessage = `Failed to fetch Drive files: ${response.status}`;
              console.error(errorMessage);
              setError(errorMessage);
              
              // Use cached data if available on error
              if (driveFilesCache.length > 0) {
                console.log('Using cached Drive files after API error');
                setDriveFiles(driveFilesCache);
              }
              setLoading(false);
              return; // Return early instead of throwing
            }
          }
        } else {
          // Successful response from changes API
          const data = await response.json();
          
          // Process changes to identify removed files
          if (data.changes) {
            data.changes.forEach(change => {
              if (change.removed) {
                removedFileIds.add(change.fileId);
                console.log(`File was removed: ${change.fileId}`);
                
                // Also remove from cache if it exists
                driveFilesCache = driveFilesCache.filter(file => file.id !== change.fileId);
              }
            });
          }
          
          files = data.files || [];
          
          // If no files were found through the changes API, try a direct files.list call
          if (files.length === 0) {
            console.log('No files returned from changes API, trying direct files.list call');
            try {
              const directResponse = await fetch('/api/drive-files');
              if (directResponse.ok) {
                const directData = await directResponse.json();
                if (directData.files && directData.files.length > 0) {
                  console.log(`Found ${directData.files.length} files through direct API call`);
                  files = directData.files;
                }
              }
            } catch (directError) {
              console.error('Error in direct files.list call:', directError);
              // Continue with empty files rather than failing
            }
          }
        }
      }
      
      // Update state and cache with the files we found
      console.log(`Setting ${files.length} Drive files to state and cache`);
      setDriveFiles(files);
      setLastChecked(new Date());
      driveFilesCache = files;
      cacheTimestamp = Date.now();
    } catch (error) {
      console.error('Error fetching Drive files and changes:', error);
      
      const errorMessage = error.message || 'Unknown error';
      
      // Check for different error types
      const isAuthenticationError = errorMessage.includes('authentication') || 
                                  errorMessage.includes('auth') ||
                                  errorMessage.includes('401');
      
      const isServerError = errorMessage.includes('500') || 
                         errorMessage.includes('server error') ||
                         errorMessage.includes('API error');
                         
      const isNetworkError = errorMessage.includes('Failed to fetch') || 
                          errorMessage.includes('Network') ||
                          errorMessage.includes('network') ||
                          errorMessage.includes('CORS');
      
      // Set a user-friendly error message
      if (isAuthenticationError) {
        setError('Authentication error. Please try refreshing the page.');
      } else if (isServerError) {
        setError('The server encountered an error. Please try again later.');
      } else if (isNetworkError) {
        setError('Network connection issue. Check your internet connection.');
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

  // Fetch folders from Google Drive
  const fetchDriveFolders = useCallback(async (forceRefresh = false) => {
    if (status !== 'authenticated') {
      return;
    }

    // Use the shared utility function
    const result = await fetchDriveFoldersWithCache({
      forceRefresh,
      setLoadingState: setFoldersLoading,
      setFoldersState: setDriveFolders
    });
    
    // Update cache if successful
    if (result.success && result.folders) {
      driveFoldersCache = result.folders;
      folderCacheTimestamp = Date.now();
    }
    
    return result;
  }, [status]);

  // Fetch files from a specific folder
  const fetchFolderFiles = useCallback(async (folderId) => {
    if (status !== 'authenticated' || !folderId) {
      return [];
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching files from folder: ${folderId}`);
      
      // Use the drive-folder-files API endpoint
      const response = await fetch(`/api/drive-folder-files?folderId=${folderId}`);
      
      if (!response.ok) {
        // For auth errors, refresh token once
        if (response.status === 401) {
          console.log('Authentication error, attempting to refresh token...');
          const refreshed = await refreshSessionTokens();
          
          if (refreshed) {
            // Try one more time after refreshing
            const retryResponse = await fetch(`/api/drive-folder-files?folderId=${folderId}`);
            
            if (!retryResponse.ok) {
              throw new Error(`API error after token refresh: ${retryResponse.status}`);
            }
            
            const data = await retryResponse.json();
            
            // Update state with folder files
            setDriveFiles(data.files || []);
            setLoading(false);
            return data.files || [];
          } else {
            throw new Error('Failed to refresh authentication token');
          }
        }
        
        // Handle other response errors
        try {
          const errorData = await response.json();
          const errorMessage = errorData.error || errorData.message || `API error: ${response.status}`;
          console.error('Error fetching folder files:', errorMessage);
          setError(errorMessage);
          setLoading(false);
          return [];
        } catch (parseError) {
          const errorMessage = `Failed to fetch folder files: ${response.status}`;
          console.error(errorMessage);
          setError(errorMessage);
          setLoading(false);
          return [];
        }
      }
      
      // Successful response
      const data = await response.json();
      const folderFiles = data.files || [];
      
      // Add detailed logging
      console.log(`Folder files received in DriveContext for folder ${folderId}:`, {
        fileCount: folderFiles.length,
        fileNames: folderFiles.map(f => f.name),
        mimeTypes: folderFiles.map(f => f.mimeType)
      });
      
      // Update state with folder files
      setDriveFiles(folderFiles);
      setLoading(false);
      return folderFiles;
    } catch (error) {
      console.error('Error fetching folder files:', error);
      
      const errorMessage = error.message || 'Unknown error';
      setError(`Failed to fetch folder files: ${errorMessage}`);
      setLoading(false);
      return [];
    }
  }, [status, refreshSessionTokens]);

  // Select a file
  const selectFile = (file) => {
    setSelectedFile(file);
    return file;
  };

  // Clear selected file
  const clearSelectedFile = () => {
    setSelectedFile(null);
  };

  // Select a folder and load its files
  const selectFolder = async (folder) => {
    setSelectedFolder(folder);
    if (folder) {
      await fetchFolderFiles(folder.id);
    } else {
      await fetchDriveFiles(true);
    }
    return folder;
  };

  // Clear selected folder and reload all files
  const clearSelectedFolder = async () => {
    setSelectedFolder(null);
    // No need to reload files, just change the filter
  };

  // Reset cache - useful for testing or when authentication changes
  const resetCache = useCallback(() => {
    driveFilesCache = [];
    driveFoldersCache = [];
    cacheTimestamp = 0;
    folderCacheTimestamp = 0;
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

  // Expose a retry function for users to manually retry on errors
  const retryFetchWithDelay = useCallback((delay = 2000) => {
    // Only retry if not already loading
    if (loading) return;
    
    console.log(`Manual retry requested, executing in ${delay}ms`);
    setError(null);
    
    setTimeout(() => {
      fetchDriveFiles(true); // Force refresh on manual retry
    }, delay);
  }, [loading, fetchDriveFiles]);

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
      
      // Fetch folders
      if (isFolderCacheValid()) {
        console.log('Using cached Drive folders on session change');
        setDriveFolders(driveFoldersCache);
      } else {
        fetchDriveFolders();
      }
    } else if (status === 'unauthenticated') {
      // Clear cache when user is not authenticated
      resetCache();
    }
  }, [status, fetchDriveFiles, fetchDriveFolders, isCacheValid, isFolderCacheValid, resetCache]);

  const value = {
    driveFiles,
    driveFolders,
    selectedFile,
    selectedFolder,
    loading,
    foldersLoading,
    error,
    isRefreshing,
    lastChecked,
    fetchDriveFiles,
    fetchDriveFolders,
    fetchFolderFiles,
    selectFile,
    clearSelectedFile,
    selectFolder,
    clearSelectedFolder,
    handleAuthError,
    resetCache,
    retryFetchWithDelay,
    getUserFriendlyErrorMessage
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

// Helper component to display Drive errors with retry option
export function DriveErrorDisplay({ className = '', onRetry = null }) {
  const { error, retryFetchWithDelay, getUserFriendlyErrorMessage } = useDrive();
  
  if (!error) return null;
  
  const friendlyMessage = getUserFriendlyErrorMessage(error);
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      retryFetchWithDelay();
    }
  };
  
  return (
    <div className={`p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg ${className}`}>
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div className="flex-1">
          <p className="text-sm text-red-700 dark:text-red-400">
            {friendlyMessage}
          </p>
        </div>
        <button
          onClick={handleRetry}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium"
        >
          Try Again
        </button>
      </div>
    </div>
  );
} 