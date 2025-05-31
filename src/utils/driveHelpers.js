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
  
  // تحديد مفتاح التخزين المؤقت
  const cacheKeyPrefix = accountId ? `drive-folders-${accountId}` : 'driveFolders';
  
  // Set loading state if provided
  if (setLoadingState) {
    setLoadingState(true);
  }
  
  // Add rate limiting to prevent excessive API calls
  // Store last API call time in memory to avoid localStorage access on every check
  const apiPath = accountId ? `/api/drive/list-folders-${accountId}` : '/api/drive/list-folders';
  const currentTime = Date.now();
  
  // إعداد متغير عام لتخزين أوقات الاستدعاء السابقة
  if (!window._lastDriveFoldersApiCalls) window._lastDriveFoldersApiCalls = {};
  const lastApiCallTime = window._lastDriveFoldersApiCalls[apiPath] || 0;
  const apiCallMinInterval = 20000; // زيادة المدة إلى 20 ثانية (بدلاً من 10)
  
  // If this is not a force refresh and we've called the API recently, wait
  if (!forceRefresh && (currentTime - lastApiCallTime) < apiCallMinInterval) {
    console.log(`API call to ${apiPath} throttled. Last call was ${currentTime - lastApiCallTime}ms ago. Using cache if available.`);
    
    // استخدام التخزين المؤقت في حالة التقييد
    const cachedFoldersJson = localStorage.getItem(cacheKeyPrefix);
    const timestamp = localStorage.getItem(`${cacheKeyPrefix}Timestamp`);
    
    if (cachedFoldersJson && timestamp) {
      try {
        const cachedFolders = JSON.parse(cachedFoldersJson);
        if (Array.isArray(cachedFolders)) {
          console.log(`Using cached Drive folders due to rate limiting, found ${cachedFolders.length} folders`);
          
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
            rateLimited: true
          };
        }
      } catch (cacheError) {
        console.error('Error reading from folder cache:', cacheError);
      }
    }
  } else if (forceRefresh) {
    console.log('Forcing refresh of Drive folders from API (bypassing cache)');
    localStorage.removeItem(cacheKeyPrefix);
    localStorage.removeItem(`${cacheKeyPrefix}Timestamp`);
    // تحديث وقت آخر استدعاء
    window._lastDriveFoldersApiCalls[apiPath] = currentTime;
  } else {
    // Normal refresh, update the last API call time
    window._lastDriveFoldersApiCalls[apiPath] = currentTime;
  }
  
  try {
    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedFoldersJson = localStorage.getItem(cacheKeyPrefix);
      const timestamp = localStorage.getItem(`${cacheKeyPrefix}Timestamp`);
      const cacheMaxAge = 20 * 60 * 1000; // زيادة المدة إلى 20 دقيقة (بدلاً من 10)
      
      if (cachedFoldersJson && timestamp) {
        // Check if cache is still valid
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
            localStorage.removeItem(cacheKeyPrefix);
            localStorage.removeItem(`${cacheKeyPrefix}Timestamp`);
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
      const cachedFoldersJson = localStorage.getItem(cacheKeyPrefix);
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
    
    // Fetch from API if cache is invalid or forcing refresh
    const endpoint = accountId 
      ? `/api/drive/list-folders?accountId=${accountId}` 
      : '/api/drive/list-folders';
      
    const response = await getWithRetry(endpoint, {
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
      const cachedFoldersJson = localStorage.getItem(cacheKeyPrefix);
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
              fromCache: true,
              apiError: true
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
      if (Array.isArray(folders)) {
        console.log(`Caching ${folders.length} Drive folders to localStorage`);
        localStorage.setItem(cacheKeyPrefix, JSON.stringify(folders));
        localStorage.setItem(`${cacheKeyPrefix}Timestamp`, Date.now().toString());
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
      const cachedFoldersJson = localStorage.getItem(cacheKeyPrefix);
      if (cachedFoldersJson) {
        try {
          const cachedFolders = JSON.parse(cachedFoldersJson);
          if (Array.isArray(cachedFolders) && cachedFolders.length > 0) {
            const timestamp = localStorage.getItem(`${cacheKeyPrefix}Timestamp`);
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
 * @param {Object} options - Configuration options
 * @param {boolean} options.forceRefresh - Whether to bypass cache and force a refresh
 * @param {string} options.accountId - Account ID to fetch files for
 * @param {string} options.folderId - Optional folder ID to filter by
 * @returns {Promise<Object>} - Result object with files or error
 */
export async function fetchDriveFilesWithCache({ forceRefresh = false, accountId, folderId = null }) {
  if (!accountId) {
    console.error('Account ID is required to fetch drive files');
    return { success: false, error: 'Account ID is required' };
  }
  
  const cacheKey = `drive-files-${accountId}${folderId ? `-${folderId}` : ''}`;
  const cacheTTL = 15 * 60 * 1000; // تم تعديل المدة إلى 15 دقيقة بدلاً من 5
  
  // للتحكم في معدل الاستعلامات
  const apiPath = `/api/drive-files-${accountId}${folderId ? `-${folderId}` : ''}`;
  const minIntervalBetweenCalls = 20000; // 20 ثانية على الأقل بين الاستعلامات
  
  // متغير عام لتخزين آخر وقت تم فيه استدعاء كل مسار API
  const lastCallTime = window._lastDriveApiCalls?.[apiPath] || 0;
  const currentTime = Date.now();
  
  // إذا لم يمض وقت كافٍ، استخدم التخزين المؤقت حتى إذا تم طلب التحديث القسري
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
  
  // تحديث وقت آخر استدعاء
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
    
    let url = `/api/drive-files?accountId=${accountId}`;
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