import { getWithRetry } from './apiHelpers';

/**
 * Fetches folders from Google Drive with caching support
 * @param {Object} options - Options for fetching folders
 * @param {boolean} options.forceRefresh - Whether to force refresh from API instead of using cache
 * @param {Function} options.setLoadingState - Function to set loading state
 * @param {Function} options.setFoldersState - Function to set folders state
 * @param {Function} options.onFolderCheck - Callback to check folder validity after fetching
 * @returns {Promise<Object>} Result object with success flag and folders or error
 */
export async function fetchDriveFoldersWithCache(options = {}) {
  const {
    forceRefresh = false,
    setLoadingState = null,
    setFoldersState = null,
    onFolderCheck = null
  } = options;
  
  // Set loading state if provided
  if (setLoadingState) {
    setLoadingState(true);
  }
  
  // Add rate limiting to prevent excessive API calls
  // Store last API call time in memory to avoid localStorage access on every check
  const currentTime = Date.now();
  const lastApiCallTime = window._lastDriveFoldersApiCall || 0;
  const apiCallMinInterval = 5000; // 5 seconds minimum between API calls
  
  // If this is not a force refresh and we've called the API recently, wait
  if (!forceRefresh && (currentTime - lastApiCallTime) < apiCallMinInterval) {
    console.log(`API call too frequent, last call was ${currentTime - lastApiCallTime}ms ago. Using cache if available.`);
    // Continue with cache check but don't remove items
    // This prevents the loop of continuous API calls when cache is empty
  } else if (forceRefresh) {
    console.log('Forcing refresh of Drive folders from API (bypassing cache)');
    localStorage.removeItem('driveFolders');
    localStorage.removeItem('driveFoldersTimestamp');
    window._lastDriveFoldersApiCall = currentTime;
  } else {
    // Normal refresh, update the last API call time
    window._lastDriveFoldersApiCall = currentTime;
  }
  
  try {
    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedFoldersJson = localStorage.getItem('driveFolders');
      const timestamp = localStorage.getItem('driveFoldersTimestamp');
      const cacheMaxAge = 10 * 60 * 1000; // 10 minutes in milliseconds
      
      if (cachedFoldersJson && timestamp) {
        // Check if cache is still valid (less than 10 minutes old)
        const cacheAge = Date.now() - parseInt(timestamp);
        if (cacheAge < cacheMaxAge) {
          try {
            const cachedFolders = JSON.parse(cachedFoldersJson);
            if (Array.isArray(cachedFolders)) {
              console.log(`Using cached Drive folders (${cacheAge / 1000}s old), found ${cachedFolders.length} folders`);
              
              // Update state if provided
              if (setFoldersState) {
                setFoldersState(cachedFolders);
              }
              
              // Run folder check callback if provided
              if (onFolderCheck && typeof onFolderCheck === 'function') {
                onFolderCheck(cachedFolders);
              }
              
              if (setLoadingState) {
                setLoadingState(false);
              }
              
              return { 
                success: true, 
                folders: cachedFolders,
                fromCache: true,
                cacheAge: Math.floor(cacheAge / (1000 * 60))
              };
            }
          } catch (cacheError) {
            console.error('Error reading from folder cache:', cacheError);
            // Clear invalid cache
            localStorage.removeItem('driveFolders');
            localStorage.removeItem('driveFoldersTimestamp');
          }
        } else {
          console.log(`Cache expired (${cacheAge / 1000}s old), fetching fresh data`);
        }
      } else if (!cachedFoldersJson) {
        console.log('No cached folders found, fetching from API');
      }
    } else {
      console.log('Force refresh requested, bypassing cache');
    }
    
    // Throttle API calls based on time since last call
    if (!forceRefresh && (currentTime - lastApiCallTime) < apiCallMinInterval) {
      // Try to use cached data instead of returning empty array
      const cachedFoldersJson = localStorage.getItem('driveFolders');
      if (cachedFoldersJson) {
        try {
          const cachedFolders = JSON.parse(cachedFoldersJson);
          if (Array.isArray(cachedFolders) && cachedFolders.length > 0) {
            console.log('API call throttled, using cached folders');
            
            // Update state if provided
            if (setFoldersState) {
              setFoldersState(cachedFolders);
            }
            
            // Run folder check callback if provided
            if (onFolderCheck && typeof onFolderCheck === 'function') {
              onFolderCheck(cachedFolders);
            }
            
            if (setLoadingState) {
              setLoadingState(false);
            }
            
            return { 
              success: true, 
              folders: cachedFolders,
              fromCache: true,
              throttled: true
            };
          }
        } catch (cacheError) {
          console.error('Error reading from folder cache during throttling:', cacheError);
        }
      }
      
      // If no cache available, return empty folders but with success=true to avoid triggering error UI
      if (setFoldersState) {
        setFoldersState([]);
      }
      
      if (setLoadingState) {
        setLoadingState(false);
      }
      
      console.log('Throttling API call, no cache available, returning empty folders array');
      return {
        success: true,
        folders: [],
        fromCache: false,
        throttled: true
      };
    }
    
    // Update last API call time
    window._lastDriveFoldersApiCall = currentTime;
    
    // Fetch from API if cache is invalid or forcing refresh
    const response = await getWithRetry('/api/drive/list-folders', {
      timeout: 30000 // 30 second timeout
    }, {
      maxRetries: 2,
      initialDelay: 2000,
      retryOnNetworkError: true
    });
    
    // Check if we got a valid response
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching Drive folders:', errorText);
      
      // Try to use cached folders as fallback
      const cachedFoldersJson = localStorage.getItem('driveFolders');
      if (cachedFoldersJson) {
        try {
          const cachedFolders = JSON.parse(cachedFoldersJson);
          if (Array.isArray(cachedFolders) && cachedFolders.length > 0) {
            console.log('Using cached folders due to API error');
            
            // Update state if provided
            if (setFoldersState) {
              setFoldersState(cachedFolders);
            }
            
            // Run folder check callback if provided
            if (onFolderCheck && typeof onFolderCheck === 'function') {
              onFolderCheck(cachedFolders);
            }
            
            if (setLoadingState) {
              setLoadingState(false);
            }
            
            return { 
              success: true, 
              folders: cachedFolders,
              fromCache: true 
            };
          }
        } catch (cacheError) {
          console.error('Error reading from folder cache:', cacheError);
        }
      }
      
      // Set empty folders array if cache attempt fails
      if (setFoldersState) {
        setFoldersState([]);
      }
      
      if (setLoadingState) {
        setLoadingState(false);
      }
      
      return {
        success: false,
        error: `Failed to fetch Drive folders: ${response.status} ${errorText}`
      };
    }
    
    // Parse the response JSON
    const data = await response.json();
    const folders = data.folders || [];
    
    console.log(`Found ${folders.length} folders in Drive`);
    
    // Update state with the fetched folders
    if (setFoldersState) {
      setFoldersState(folders);
    }
    
    // Run folder check callback if provided
    if (onFolderCheck && typeof onFolderCheck === 'function') {
      onFolderCheck(folders);
    }
    
    // Cache the folder data for future use - even if empty to prevent repeated calls
    try {
      if (Array.isArray(folders) && folders.length > 0) {
        console.log(`Caching ${folders.length} Drive folders to localStorage`);
        localStorage.setItem('driveFolders', JSON.stringify(folders));
        localStorage.setItem('driveFoldersTimestamp', Date.now().toString());
      } else {
        console.warn('Not caching empty folders array to prevent overwriting valid cache');
        // Only update timestamp if we don't have any cached data
        if (!localStorage.getItem('driveFolders')) {
          localStorage.setItem('driveFoldersTimestamp', Date.now().toString());
        }
      }
    } catch (cacheError) {
      console.warn('Failed to cache folders in localStorage:', cacheError);
    }
    
    if (setLoadingState) {
      setLoadingState(false);
    }
    
    return { 
      success: true, 
      folders: folders
    };
  } catch (error) {
    console.error('Error fetching Drive folders:', error);
    
    // Handle AbortError (timeout) specifically
    const isTimeout = error.name === 'AbortError' || 
                      error.message?.includes('timeout') ||
                      error.code === 'ETIMEDOUT';
    
    // Try to use cached folders if available (especially important for timeouts)
    if (isTimeout) {
      console.log('Timeout when fetching folders, checking cache');
      const cachedFoldersJson = localStorage.getItem('driveFolders');
      if (cachedFoldersJson) {
        try {
          const cachedFolders = JSON.parse(cachedFoldersJson);
          if (Array.isArray(cachedFolders) && cachedFolders.length > 0) {
            const timestamp = localStorage.getItem('driveFoldersTimestamp');
            const cacheAge = timestamp ? Math.floor((Date.now() - parseInt(timestamp)) / (1000 * 60)) : 'unknown';
            console.log(`Using cached folders (${cacheAge} minutes old) due to timeout`);
            
            // Update state if provided
            if (setFoldersState) {
              setFoldersState(cachedFolders);
            }
            
            // Run folder check callback if provided
            if (onFolderCheck && typeof onFolderCheck === 'function') {
              onFolderCheck(cachedFolders);
            }
            
            if (setLoadingState) {
              setLoadingState(false);
            }
            
            return { 
              success: true, 
              folders: cachedFolders,
              fromCache: true,
              cacheAge: cacheAge
            };
          }
        } catch (cacheError) {
          console.error('Error reading from folder cache:', cacheError);
        }
      }
    }
    
    // If we get here, we couldn't get folders from the API or cache
    if (setFoldersState) {
      setFoldersState([]);
    }
    
    if (setLoadingState) {
      setLoadingState(false);
    }
    
    return {
      success: false,
      error: isTimeout 
        ? 'Fetching Drive folders timed out' 
        : `Error fetching Drive folders: ${error.message}`,
      isTimeout: isTimeout
    };
  }
}

/**
 * Checks the processing status of a video in Google Drive
 * 
 * @param {string} fileId - The ID of the file in Google Drive
 * @returns {Promise<object>} - Processing status information 
 */
export async function checkDriveVideoProcessing(fileId) {
  if (!fileId) return { error: 'No file ID provided' };
  
  try {
    const response = await fetch(`/api/drive/check-processing?fileId=${fileId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return { 
        error: `Failed to check processing status: ${response.status}`,
        status: 'error'
      };
    }
    
    const data = await response.json();
    return {
      ...data,
      status: data.isProcessing ? 'processing' : 'ready'
    };
  } catch (error) {
    console.error('Error checking video processing status:', error);
    return { 
      error: error.message || 'Unknown error checking processing status',
      status: 'error'
    };
  }
}