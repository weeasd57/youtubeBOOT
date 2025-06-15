import { getWithRetry } from './apiHelpers';
import { getStorageItem, setStorageItem } from './localStorage';

/**
 * Fetches folders from Google Drive with caching support
 * @param {Object} options - Options for fetching folders
 * @param {boolean} options.forceRefresh - Whether to force refresh from API instead of using cache
 * @param {Function} options.setLoadingState - Function to set loading state
 * @param {Function} options.setFoldersState - Function to set folders state
 * @param {Function} options.onFolderCheck - Callback to check folder validity after fetching
 * @param {string} options.accountId - Account ID to use for fetching folders
 * @returns {Promise<Object>} Result object with success flag and folders or error
 */
export async function fetchDriveFoldersWithCache(options = {}) {
  const {
    forceRefresh = false,
    setLoadingState = null,
    setFoldersState = null,
    onFolderCheck = null,
    accountId = null
  } = options;
  
  const cacheKeyPrefix = accountId ? `drive-folders-${accountId}` : 'driveFolders';
  
  if (setLoadingState) {
    setLoadingState(true);
  }

  // Global request tracking
  if (typeof window !== 'undefined' && !window._driveFolderRequests) {
    window._driveFolderRequests = {
      inProgress: new Map(),
      lastSuccess: new Map(),
      retryCount: new Map(),
      lastApiCall: new Map() // Track last API call time regardless of success
    };
  }

  const requests = window._driveFolderRequests;
  const apiPath = accountId
    ? `/api/drive/list-folders?accountId=${accountId}`
    : '/api/drive/list-folders';

  // Check if there's already a request in progress
  if (!forceRefresh && requests.inProgress.get(apiPath)) {
    console.log(`Request already in progress for ${apiPath}, waiting...`);
    try {
      return await requests.inProgress.get(apiPath);
    } catch (error) {
      console.error('Error while waiting for in-progress request:', error);
    }
  }

  // Rate limiting check - increased from 5 seconds to 30 seconds
  const lastSuccess = requests.lastSuccess.get(apiPath) || 0;
  const lastApiCall = requests.lastApiCall.get(apiPath) || 0;
  const minInterval = 30000; // 30 seconds between API calls (increased from 5s)
  const timeSinceLastSuccess = Date.now() - lastSuccess;
  const timeSinceLastCall = Date.now() - lastApiCall;

  // Check cache validity
  const cachedData = getStorageItem(cacheKeyPrefix);
  const cacheAge = cachedData ? Date.now() - (cachedData.timestamp || 0) : Infinity;
  const cacheTTL = 5 * 60 * 1000; // 5 minutes cache TTL (increased from implicit short time)
  const isCacheValid = cachedData && Array.isArray(cachedData.folders) && cacheAge < cacheTTL;

  // Use cache in more scenarios to reduce API calls
  if (!forceRefresh && (
      (timeSinceLastCall < minInterval) || // Rate limiting
      (isCacheValid && timeSinceLastSuccess < minInterval * 6) // Valid cache and not too old
    )) {
    console.log(`Using cache for ${apiPath}: rate limiting active or cache valid`);
    
    if (isCacheValid) {
      if (setFoldersState) {
        setFoldersState(cachedData.folders);
      }
      if (setLoadingState) {
        setLoadingState(false);
      }
      return { 
        success: true, 
        folders: cachedData.folders,
        fromCache: true,
        throttled: timeSinceLastCall < minInterval
      };
    }
  }

  // Update last API call time
  requests.lastApiCall.set(apiPath, Date.now());

  // Create the fetch promise
  const fetchPromise = (async () => {
    try {
      const response = await getWithRetry(
        apiPath,
        { 
          timeout: 30000,
        },
        { maxRetries: 2, initialDelay: 2000, retryOnNetworkError: true }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const folders = data.folders || [];

      // Cache successful results
      if (Array.isArray(folders)) {
        setStorageItem(cacheKeyPrefix, {
          folders,
          timestamp: Date.now()
        });
      }

      requests.lastSuccess.set(apiPath, Date.now());
      
      if (setFoldersState) {
        setFoldersState(folders);
      }
      if (setLoadingState) {
        setLoadingState(false);
      }

      return { success: true, folders };
    } catch (error) {
      console.error('Error fetching folders:', error);
      
      // Try to use cached data on error
      const cachedData = getStorageItem(cacheKeyPrefix);
      if (cachedData && Array.isArray(cachedData.folders)) {
        if (setFoldersState) {
          setFoldersState(cachedData.folders);
        }
        return {
          success: true,
          folders: cachedData.folders,
          fromCache: true,
          error: error.message
        };
      }
      
      throw error;
    } finally {
      requests.inProgress.delete(apiPath);
      if (setLoadingState) {
        setLoadingState(false);
      }
    }
  })();

  // Store the promise for deduplication
  requests.inProgress.set(apiPath, fetchPromise);

  return fetchPromise;
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

/**
 * Fetches drive folders with caching support
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.forceRefresh - Whether to bypass cache and force a refresh
 * @param {string} options.accountId - Account ID to fetch drive folders for
 * @param {Function} options.onFolderCheck - Callback for progress monitoring
 * @returns {Promise<Object>} - Result object with folders or error
 */
export async function fetchAccountDriveFolders({ forceRefresh = false, accountId, onFolderCheck = () => {} }) {
  if (!accountId) {
    console.error('Account ID is required to fetch drive folders');
    return { success: false, error: 'Account ID is required' };
  }
  
  const cacheKey = `drive-folders-${accountId}`;
  const cacheTTL = 15 * 60 * 1000; // 15 minutes
  
  // Check cache if not forcing refresh
  if (!forceRefresh) {
    const cachedData = getStorageItem(cacheKey);
    if (cachedData && cachedData.timestamp) {
      const age = Date.now() - cachedData.timestamp;
      if (age < cacheTTL) {
        console.log(`Using cached drive folders for account ${accountId}, age: ${Math.round(age/1000)}s`);
        return { 
          success: true, 
          folders: cachedData.folders,
          fromCache: true
        };
      }
    }
  }
  
  // Fetch fresh data
  try {
    console.log(`Fetching drive folders for account ${accountId}`);
    onFolderCheck({ status: 'loading', message: 'Fetching Google Drive folders...' });
    
    const response = await fetch(`/api/drive-folders?accountId=${accountId}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
      console.error(`Error fetching drive folders: ${errorData.message || response.statusText}`);
      
      onFolderCheck({ 
        status: 'error', 
        message: errorData.message || `Error: ${response.status} ${response.statusText}` 
      });
      
      return { 
        success: false, 
        error: errorData.message || `Error: ${response.status} ${response.statusText}` 
      };
    }
    
    const data = await response.json();
    
    if (!data.folders || !Array.isArray(data.folders)) {
      console.error('Invalid drive folders response format', data);
      
      onFolderCheck({ 
        status: 'error', 
        message: 'Invalid response format from server' 
      });
      
      return { 
        success: false, 
        error: 'Invalid response format' 
      };
    }
    
    // Cache the response
    setStorageItem(cacheKey, {
      folders: data.folders,
      timestamp: Date.now()
    });
    
    onFolderCheck({ 
      status: 'success', 
      message: `Found ${data.folders.length} folders` 
    });
    
    return { 
      success: true, 
      folders: data.folders
    };
    
  } catch (error) {
    console.error('Error fetching drive folders:', error);
    
    onFolderCheck({ 
      status: 'error', 
      message: error.message || 'An unexpected error occurred' 
    });

    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred'
    };
  }
}

/**
 * Fetches drive files for an account with caching support
 * 
 * @param {Object} param - Configuration options
 * @param {boolean} param.forceRefresh - Whether to bypass cache and force a refresh
 * @param {string} param.accountId - Account ID to fetch files for
 * @param {string} param.folderId - Optional folder ID to filter by
 * @returns {Promise<Object>} - Result object with files or error
 */
export async function fetchDriveFilesWithCache(param) {
  let { forceRefresh = false, accountId, folderId = null } = param;
  if (!accountId) {
    console.error('Account ID is required to fetch drive files');
    return { success: false, error: 'Account ID is required' };
  }
  
  const cacheKey = `drive-files-${accountId}${folderId ? `-${folderId}` : ''}`;
  const cacheTTL = 15 * 60 * 1000; // 15 minutes cache TTL
  
  // Rate limiting control
  const apiPath = `/api/drive-files-${accountId}${folderId ? `-${folderId}` : ''}`;
  const minIntervalBetweenCalls = 20000; // 20 seconds minimum between calls
  
  // Global variable to store the last time each API path was called
  const lastCallTime = window._lastDriveApiCalls?.[apiPath] || 0;
  const currentTime = Date.now();
  
  // If not enough time has passed, use cache even if force refresh was requested
  if (currentTime - lastCallTime < minIntervalBetweenCalls && !window.bypassRateLimits) {
    console.log(`API call to ${apiPath} throttled. Last call was ${currentTime - lastCallTime}ms ago.`);
    const cachedData = getStorageItem(cacheKey);
    if (cachedData && cachedData.timestamp) {
      console.log(`Using cached drive files for account ${accountId} due to rate limiting`);
      return { 
        success: true, 
        files: cachedData.files,
        fromCache: true,
        rateLimited: true
      };
    }
  }
  
  // Update last call time
  if (!window._lastDriveApiCalls) window._lastDriveApiCalls = {};
  window._lastDriveApiCalls[apiPath] = currentTime;
  
  // Check cache if not forcing refresh
  if (!forceRefresh) {
    const cachedData = getStorageItem(cacheKey);
    if (cachedData && cachedData.timestamp) {
      const age = Date.now() - cachedData.timestamp;
      if (age < cacheTTL) {
        console.log(`Using cached drive files for account ${accountId}, age: ${Math.round(age/1000)}s`);
        return { 
          success: true, 
          files: cachedData.files,
          fromCache: true
        };
      }
    }
  }
  
  // Fetch fresh data
  try {
    console.log(`Fetching drive files for account ${accountId}${folderId ? ` in folder ${folderId}` : ''}`);
    
    let url = `/api/drive/list-files?accountId=${accountId}`;
    if (folderId) {
      url += `&folderId=${folderId}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
      console.error(`Error fetching drive files: ${errorData.message || response.statusText}`);
      
      // في حالة الخطأ، حاول استخدام التخزين المؤقت كإجراء احتياطي
      const cachedData = getStorageItem(cacheKey);
      if (cachedData && cachedData.files) {
        console.log(`Using cached drive files for account ${accountId} due to API error`);
        return { 
          success: true, 
          files: cachedData.files,
          fromCache: true,
          apiError: true
        };
      }
      
      return { 
        success: false, 
        error: errorData.message || `Error: ${response.status} ${response.statusText}` 
      };
    }
    
    const data = await response.json();
    
    if (!data.files || !Array.isArray(data.files)) {
      console.error('Invalid drive files response format', data);
      
      // في حالة بيانات غير صالحة، حاول استخدام التخزين المؤقت كإجراء احتياطي
      const cachedData = getStorageItem(cacheKey);
      if (cachedData && cachedData.files) {
        console.log(`Using cached drive files for account ${accountId} due to invalid response format`);
        return { 
          success: true, 
          files: cachedData.files,
          fromCache: true,
          invalidFormat: true
        };
      }
      
      return { 
        success: false, 
        error: 'Invalid response format' 
      };
    }
    
    // Cache the response
    setStorageItem(cacheKey, {
      files: data.files,
      timestamp: Date.now()
    });
    
    return { 
      success: true, 
      files: data.files
    };
    
  } catch (error) {
    console.error('Error fetching drive files:', error);
    
    // في حالة استثناء، حاول استخدام التخزين المؤقت كإجراء احتياطي
    const cachedData = getStorageItem(cacheKey);
    if (cachedData && cachedData.files) {
      console.log(`Using cached drive files for account ${accountId} due to exception: ${error.message}`);
      return { 
        success: true, 
        files: cachedData.files,
        fromCache: true,
        exception: true
      };
    }
    
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred'
    };
  }
}

// This function was removed to fix the duplicate declaration error
// The original fetchDriveFilesWithCache function at the top of the file is used instead