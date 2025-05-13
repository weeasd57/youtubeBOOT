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
  
  try {
    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedFoldersJson = localStorage.getItem('driveFolders');
      const timestamp = localStorage.getItem('driveFoldersTimestamp');
      
      if (cachedFoldersJson && timestamp) {
        // Check if cache is still valid (less than 10 minutes old)
        const cacheAge = Math.floor((Date.now() - parseInt(timestamp)) / (1000 * 60));
        if (cacheAge < 10) {
          try {
            const cachedFolders = JSON.parse(cachedFoldersJson);
            if (Array.isArray(cachedFolders) && cachedFolders.length > 0) {
              console.log(`Using cached folders (${cacheAge} minutes old)`);
              
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
    }
    
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
    
    // Cache the folder data for future use
    if (folders.length > 0) {
      try {
        localStorage.setItem('driveFolders', JSON.stringify(folders));
        localStorage.setItem('driveFoldersTimestamp', Date.now().toString());
      } catch (cacheError) {
        console.warn('Failed to cache folders in localStorage:', cacheError);
      }
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