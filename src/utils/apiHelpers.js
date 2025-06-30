/**
 * Utility functions for API calls with enhanced error handling and development support
 */
import { 
  API_TIMEOUTS, 
  RETRY_CONFIG, 
  RETRY_STATUS_CODES, 
  isRetryableError, 
  calculateRetryDelay 
} from './api-config';

/**
 * Normalize URL to ensure correct protocol for development
 * @param {string} url - The URL to normalize
 * @returns {string} - Normalized URL
 */
function normalizeUrl(url) {
  // If it's a relative URL, return as is
  if (!url.startsWith('http')) {
    return url;
  }
  
  // In development, ensure we use http:// for localhost to avoid SSL errors
  if (process.env.NODE_ENV === 'development') {
    // Handle various localhost formats
    const localhostPatterns = [
      'https://localhost',
      'https://127.0.0.1',
      'https://0.0.0.0'
    ];
    
    let normalizedUrl = url;
    for (const pattern of localhostPatterns) {
      if (url.includes(pattern)) {
        normalizedUrl = url.replace(pattern, pattern.replace('https://', 'http://'));
        break;
      }
    }
    
    if (normalizedUrl !== url) {
      console.log(`[URL Normalization] Changed ${url} to ${normalizedUrl} for development`);
    }
    return normalizedUrl;
  }
  
  return url;
}

/**
 * Get the base URL for API calls
 * @returns {string} - Base URL
 */
function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // Client-side: use current origin but normalize for development
    let origin = window.location.origin;
    
    // In development, force HTTP for localhost to avoid SSL errors
    if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
      origin = origin.replace('https://localhost', 'http://localhost');
      console.log(`[Base URL] Normalized origin to: ${origin}`);
    }
    
    return origin;
  }
  
  // Server-side: use environment variable or default
  return process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/**
 * وحدة مساعدة للتحكم في معدل استعلامات API
 */

// متغير عام لتخزين آخر وقت تم فيه استدعاء كل مسار API
const apiThrottleMap = {};

/**
 * دالة للتحقق مما إذا كان يمكن استدعاء API معين استنادًا إلى قيود معدل الاستدعاء
 * @param {string} apiPath - مسار API المراد استدعاؤه
 * @param {number} minInterval - الحد الأدنى للفاصل الزمني بين الاستدعاءات بالمللي ثانية
 * @returns {boolean} - ما إذا كان يمكن استدعاء API
 */
export function canCallApi(apiPath, minInterval = 10000) {
  const now = Date.now();
  const lastCallTime = apiThrottleMap[apiPath] || 0;
  
  // إذا لم يمر وقت كاف منذ آخر استدعاء، ارجع false
  if (now - lastCallTime < minInterval) {
    console.log(`[Rate Limiter] API call to ${apiPath} throttled. Last call was ${now - lastCallTime}ms ago.`);
    return false;
  }
  
  // تحديث وقت آخر استدعاء
  apiThrottleMap[apiPath] = now;
  return true;
}

/**
 * دالة مساعدة لاستدعاء API مع التحكم في معدل الاستدعاء
 * @param {string} url - عنوان URL للاستدعاء
 * @param {Object} options - خيارات الاستدعاء
 * @param {number} minInterval - الحد الأدنى للفاصل الزمني بين الاستدعاءات بالمللي ثانية
 * @returns {Promise<Response>} - استجابة الاستدعاء أو استجابة مخزنة مؤقتًا
 */
export async function fetchWithThrottle(url, options = {}, minInterval = 10000) {
  // استخراج المسار الأساسي من URL
  const normalizedUrl = normalizeUrl(url);
  const urlObj = new URL(normalizedUrl, getBaseUrl());
  const apiPath = urlObj.pathname;
  
  // التحقق مما إذا كان يمكن استدعاء API
  if (!canCallApi(apiPath, minInterval)) {
    // محاولة استرداد استجابة مخزنة مؤقتًا
    try {
      const cachedResponse = localStorage.getItem(`api_cache_${apiPath}`);
      if (cachedResponse) {
        console.log(`[Cache] Using cached response for ${apiPath}`);
        return new Response(cachedResponse, {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'X-From-Cache': 'true' }
        });
      }
    } catch (e) {
      console.warn('[Cache] Error accessing cache:', e);
    }
    
    // إذا لم تكن هناك استجابة مخزنة، ارجع استجابة خطأ
    return new Response(JSON.stringify({ error: 'Rate limited', cached: false }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // استدعاء API
  try {
    const response = await fetch(normalizedUrl, options);
    
    // إذا كانت الاستجابة ناجحة، قم بتخزينها مؤقتًا
    if (response.ok) {
      try {
        const clonedResponse = response.clone();
        const responseText = await clonedResponse.text();
        localStorage.setItem(`api_cache_${apiPath}`, responseText);
        localStorage.setItem(`api_cache_${apiPath}_time`, Date.now().toString());
      } catch (e) {
        console.warn('[Cache] Error caching response:', e);
      }
    }
    
    return response;
  } catch (error) {
    console.error(`[API] Error fetching ${normalizedUrl}:`, error);
    throw error;
  }
}

/**
 * دالة لتنظيف ذاكرة التخزين المؤقت القديمة
 * @param {number} maxAge - العمر الأقصى للبيانات المخزنة مؤقتًا بالمللي ثانية
 */
export function cleanupApiCache(maxAge = 3600000) { // ساعة واحدة افتراضيًا
  try {
    const now = Date.now();
    
    // البحث عن جميع مفاتيح التخزين المؤقت
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      
      // التحقق مما إذا كان المفتاح يتعلق بالتخزين المؤقت للـ API
      if (key && key.startsWith('api_cache_')) {
        // التحقق من الوقت
        const timeKey = `${key}_time`;
        const timestamp = parseInt(localStorage.getItem(timeKey) || '0', 10);
        
        // إذا كان العمر أكبر من الحد الأقصى، قم بحذفه
        if (now - timestamp > maxAge) {
          localStorage.removeItem(key);
          localStorage.removeItem(timeKey);
          console.log(`[Cache] Cleaned up stale cache for ${key}`);
        }
      }
    }
  } catch (e) {
    console.warn('[Cache] Error cleaning up cache:', e);
  }
}

// تنظيف التخزين المؤقت عند تحميل الصفحة
if (typeof window !== 'undefined') {
  // تأخير التنظيف لتجنب التأثير على أداء تحميل الصفحة
  setTimeout(() => {
    cleanupApiCache();
  }, 5000);
}

/**
 * Executes a function with exponential backoff retry logic
 * @param {Function} fn - The async function to execute
 * @param {Object} options - Configuration options
 * @param {Number} options.maxRetries - Maximum number of retry attempts (default: 5, use -1 for infinite retries)
 * @param {Number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {Number} options.maxDelay - Maximum delay in ms (default: 30000)
 * @param {Function} options.shouldRetry - Function that determines if retry should happen (default: retry on all errors)
 * @param {Function} options.onRetry - Callback function when a retry occurs
 * @returns {Promise} - Result of the function execution
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = RETRY_CONFIG.MAX_RETRIES,
    initialDelay = RETRY_CONFIG.BASE_DELAY,
    maxDelay = RETRY_CONFIG.MAX_DELAY,
    shouldRetry = () => true,
    onRetry = () => {}
  } = options;
  
  let retries = 0;
  const infiniteRetry = maxRetries === -1;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      // Log detailed error info to help debugging
      console.error("API Error details:", JSON.stringify({
        message: error.message,
        status: error.status || error.code,
        response: error.response?.data || error.response,
        errors: error.errors
      }));
      
      // Don't retry if we've hit max retries (unless infinite) or if shouldRetry returns false
      if ((!infiniteRetry && retries >= maxRetries) || !shouldRetry(error)) {
        throw error;
      }
      
      // Calculate exponential backoff with jitter
      const delay = Math.min(
        maxDelay,
        initialDelay * Math.pow(2, Math.min(retries, 10)) * (0.5 + Math.random() * 0.5)
      );
      
      // Call onRetry callback with relevant information
      onRetry({
        error,
        retryCount: retries + 1,
        delay,
        maxRetries: infiniteRetry ? 'infinite' : maxRetries
      });
      
      // Wait for the backoff period
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Increment retry counter
      retries++;
    }
  }
}

/**
 * Creates a function that will automatically retry on authentication errors
 * @param {Function} fn - The async function to execute
 * @param {Object} options - Additional options for withRetry
 * @returns {Promise} - Result of the function execution
 */
export function withAuthRetry(fn, options = {}) {
  return withRetry(fn, {
    maxRetries: -1, // Infinite retries for auth issues
    initialDelay: 5000, // Start with a 5 second delay
    maxDelay: 30000, // Cap at 30 seconds
    shouldRetry: (error) => isAuthError(error) || options.shouldRetry?.(error) || false,
    onRetry: ({ error, retryCount, delay }) => {
      console.log(`Auth retry #${retryCount} after ${Math.round(delay/1000)}s - ${error.message || 'Unknown error'}`);
      options.onRetry?.({ error, retryCount, delay });
    },
    ...options
  });
}

/**
 * Determine if an error is due to authentication issues
 * @param {Error} error - The error to check
 * @returns {Boolean} - True if it's an auth error
 */
export function isAuthError(error) {
  return error.response?.status === 401 || 
         error.response?.status === 403;
}

/**
 * Determine if an error is due to a quota exceeded
 * @param {Error} error - The error to check
 * @returns {Boolean} - True if it's a quota error
 */
export function isQuotaError(error) {
  // Check various error formats that could indicate a quota issue
  if (!error) return false;
  
  // Check for quota or rate limit messages in error or its response
  const errorMessage = error.message || '';
  const hasQuotaInMessage = errorMessage.toLowerCase().includes('quota') || 
                           errorMessage.toLowerCase().includes('rate limit');
  
  // Check for quotaExceeded reason in Google API errors array
  const errors = error.errors || (error.response?.data?.error?.errors) || [];
  const hasQuotaError = errors.some(err => 
    err.reason === 'quotaExceeded' || 
    err.reason === 'rateLimitExceeded' ||
    (err.message && err.message.toLowerCase().includes('quota'))
  );
  
  // Check for error reasons in Google API error details
  const errorDetails = error.response?.data?.error || {};
  const errorReason = errorDetails.errors?.[0]?.reason || '';
  const hasQuotaReason = errorReason === 'quotaExceeded' || errorReason === 'rateLimitExceeded';
  
  // Check status codes - 403 and 429 are common for quota/rate limit issues
  const statusCode = error.status || error.code || error.response?.status || 0;
  const hasLimitStatusCode = statusCode === 403 || statusCode === 429;
  
  return hasQuotaInMessage || 
         hasQuotaError || 
         hasQuotaReason || 
         (hasLimitStatusCode && (errorDetails.message || '').toLowerCase().includes('quota'));
}

/**
 * Determine if an error is a network-related error
 * @param {Error} error - The error to check
 * @returns {Boolean} - True if it's a network error
 */
export function isNetworkError(error) {
  if (!error) return false;
  
  const errorMessage = error.message || '';
  
  // Check for common network error patterns
  const networkErrorPatterns = [
    'ERR_SSL_PROTOCOL_ERROR',
    'ERR_NETWORK',
    'ERR_INTERNET_DISCONNECTED',
    'ERR_CONNECTION_REFUSED',
    'ERR_CONNECTION_RESET',
    'ERR_CONNECTION_TIMED_OUT',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'network error',
    'fetch error'
  ];
  
  return networkErrorPatterns.some(pattern => 
    errorMessage.includes(pattern) || 
    error.code === pattern ||
    error.name === pattern
  );
}

/**
 * Get a user-friendly error message for different error types
 * @param {Error} error - The error to get message for
 * @returns {string} - User-friendly error message
 */
export function getUserFriendlyErrorMessage(error) {
  if (!error) return 'حدث خطأ غير معروف';
  
  if (isNetworkError(error)) {
    return 'مشكلة في الاتصال بالإنترنت. يرجى التحقق من اتصالك والمحاولة مرة أخرى.';
  }
  
  if (isQuotaError(error)) {
    return 'تم تجاوز حد الاستخدام المسموح. يرجى المحاولة لاحقاً.';
  }
  
  if (isAuthError(error)) {
    return 'مشكلة في ال��وثيق. يرجى تسجيل الدخول مرة أخرى.';
  }
  
  const statusCode = error.status || error.response?.status;
  if (statusCode) {
    switch (statusCode) {
      case 400:
        return 'طلب غير صحيح. يرجى التحقق من البيانات المدخلة.';
      case 404:
        return 'المورد المطلوب غير موجود.';
      case 500:
        return 'خطأ في الخادم. يرجى المحاولة لاحقاً.';
      case 503:
        return 'الخدمة غير متاحة حالياً. يرجى المحاولة لاحقاً.';
      default:
        return `حدث خطأ (${statusCode}). يرجى المحاولة مرة أخرى.`;
    }
  }
  
  return error.message || 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
}

/**
 * Executes a fetch request with exponential backoff retry logic
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @param {Object} retryOptions - Configuration options for retry
 * @param {Number} retryOptions.maxRetries - Maximum number of retry attempts (default: 5)
 * @param {Number} retryOptions.initialDelay - Initial delay in ms (default: 1000)
 * @param {Number} retryOptions.maxDelay - Maximum delay in ms (default: 30000)
 * @param {Number} retryOptions.factor - Backoff factor (default: 2)
 * @param {Array} retryOptions.retryOnStatus - HTTP status codes to retry on (default: [429, 500, 502, 503, 504])
 * @param {Boolean} retryOptions.retryOnNetworkError - Whether to retry on network errors (default: true)
 * @returns {Promise<Response>} - The fetch response
 */
export async function fetchWithRetry(url, options = {}, retryOptions = {}) {
  const {
    maxRetries = RETRY_CONFIG.MAX_RETRIES,
    initialDelay = RETRY_CONFIG.BASE_DELAY,
    maxDelay = RETRY_CONFIG.MAX_DELAY,
    factor = RETRY_CONFIG.BACKOFF_FACTOR,
    retryOnStatus = RETRY_STATUS_CODES,
    retryOnNetworkError = true
  } = retryOptions;

  // Normalize the URL to handle development environment
  const normalizedUrl = normalizeUrl(url);
  // Construct the full URL using getBaseUrl for robust handling of relative paths and development protocol
  let fullUrl;
  
  try {
    fullUrl = new URL(normalizedUrl, getBaseUrl()).toString();
    // Apply normalization again to the final URL to ensure consistency
    fullUrl = normalizeUrl(fullUrl);
  } catch (error) {
    console.error('[URL Construction Error]', error);
    // Fallback to simple concatenation if URL constructor fails
    const baseUrl = getBaseUrl();
    fullUrl = normalizedUrl.startsWith('/') ? `${baseUrl}${normalizedUrl}` : normalizedUrl;
    fullUrl = normalizeUrl(fullUrl);
  }

  let delay = initialDelay;
  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    let timeoutId = null; // Move timeoutId declaration to proper scope
    
    try {
      const controller = new AbortController();
      timeoutId = createTimeoutController(options.timeout, controller);

      // Add the abort signal to our fetch options if not already present
      const fetchOptions = {
        ...options,
        signal: options.signal || controller.signal
      };

      const response = await fetch(fullUrl, fetchOptions);

      // Clear the timeout if we have one
      timeoutId = clearTimeoutSafely(timeoutId);

      // If we get a status code we should retry on
      if (retryOnStatus.includes(response.status) && attempt < maxRetries) {
        attempt++;
        lastError = new Error(`Received status ${response.status}`);
        
        // Log the retry attempt with more details
        console.warn(`[API Retry] ${normalizedUrl} failed with status ${response.status}. Attempt ${attempt}/${maxRetries}, waiting ${Math.round(delay/1000)}s...`);
        
        // Wait for the calculated delay and then continue to next iteration
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Exponential backoff with jitter
        delay = Math.min(delay * factor * (0.9 + 0.2 * Math.random()), maxDelay);
        continue;
      }

      // For successful responses or final attempts with error status
      return response;
    } catch (error) {
      lastError = error;

      // Clear any existing timeout
      timeoutId = clearTimeoutSafely(timeoutId);

      // Check for SSL protocol errors specifically
      const isSSLError = error.message?.includes('ERR_SSL_PROTOCOL_ERROR');
      
      // Use our improved network error detection
      const isNetworkErr = isNetworkError(error);
      
      const isTimeout = (
        error.name === 'AbortError' || 
        error.name === 'TimeoutError' || 
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('timeout')
      );

      // If this is not a network error or timeout or we've used all our retries, throw the error
      if ((!isNetworkErr && !isTimeout) || !retryOnNetworkError || attempt >= maxRetries) {
        // For SSL errors in development, try one more time with HTTP
        if (isSSLError && process.env.NODE_ENV === 'development' && attempt === 0) {
          console.warn('[SSL Error Recovery] Attempting to retry with HTTP protocol...');
          // Force HTTP and retry once more
          const httpUrl = fullUrl.replace('https://', 'http://');
          if (httpUrl !== fullUrl) {
            console.log(`[SSL Error Recovery] Retrying with: ${httpUrl}`);
            try {
              const response = await fetch(httpUrl, fetchOptions);
              console.log('[SSL Error Recovery] Success with HTTP!');
              return response;
            } catch (httpError) {
              console.error('[SSL Error Recovery] HTTP retry also failed:', httpError.message);
            }
          }
        }
        
        // For SSL errors in development, provide a helpful message
        if (isSSLError && process.env.NODE_ENV === 'development') {
          console.error('SSL Protocol Error detected. This usually happens when trying to use HTTPS with localhost. The URL has been normalized to use HTTP.');
          console.error('User-friendly message:', getUserFriendlyErrorMessage(error));
        }
        throw error;
      }

      attempt++;
      
      // Log the retry attempt with more details
      console.warn(`[API Retry] ${normalizedUrl} failed (${error.message}). Attempt ${attempt}/${maxRetries}, waiting ${Math.round(delay/1000)}s...`);
      
      // Wait before the next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff with jitter
      delay = Math.min(delay * factor * (0.9 + 0.2 * Math.random()), maxDelay);
    }
  }

  // If we've exhausted all retries, throw the last error
  throw lastError || new Error(`Failed after ${maxRetries} retries`);
}

// Helper for timeout-safe GET requests with retry
export async function getWithRetry(url, options = {}, retryOptions = {}) {
  return fetchWithRetry(url, {
    method: 'GET',
    timeout: options.timeout || API_TIMEOUTS.DEFAULT,
    ...options
  }, retryOptions);
}

// Helper for timeout-safe POST requests with retry
export async function postWithRetry(url, data, options = {}, retryOptions = {}) {
  return fetchWithRetry(url, {
    method: 'POST',
    body: JSON.stringify(data),
    timeout: options.timeout || API_TIMEOUTS.DEFAULT,
    ...options
  }, retryOptions);
}

/**
 * Helper to safely parse JSON response and handle HTML responses
 * @param {Response} response - Fetch response object
 * @returns {Promise<Object>} - Parsed JSON or error object
 */
export async function safeJsonParse(response) {
  try {
    const text = await response.text();
    
    // Check if response is HTML (common when redirected to login page)
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      console.warn('[JSON Parse] Received HTML instead of JSON. This usually indicates an authentication redirect.');
      return {
        error: 'Authentication required',
        message: 'Received HTML response instead of JSON. Please check your authentication.',
        isHtmlResponse: true,
        responseText: text.substring(0, 200) + '...' // First 200 chars for debugging
      };
    }
    
    // Try to parse as JSON
    if (!text) {
      return {
        error: 'Empty response',
        message: 'Server returned empty response'
      };
    }
    
    return JSON.parse(text);
  } catch (error) {
    console.error('[JSON Parse Error]', error);
    return {
      error: 'Invalid JSON',
      message: 'Failed to parse server response as JSON',
      parseError: error.message
    };
  }
}

/**
 * Enhanced fetch wrapper with JSON parsing and error handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {Object} retryOptions - Retry configuration
 * @returns {Promise<Object>} - Parsed response or error
 */
export async function fetchJsonWithRetry(url, options = {}, retryOptions = {}) {
  try {
    const response = await fetchWithRetry(url, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      },
      credentials: 'include', // Always include cookies for auth
      ...options
    }, retryOptions);
    
    // Check if response is ok
    if (!response.ok) {
      const errorData = await safeJsonParse(response);
      
      // Create error with status code for better handling
      let errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
      
      // Add more specific error messages for common status codes
      if (response.status === 401) {
        errorMessage = errorData.message || 'Authentication failed. Please check your credentials.';
      } else if (response.status === 403) {
        errorMessage = errorData.message || 'Access forbidden. You may not have permission to access this resource.';
      } else if (response.status === 404) {
        errorMessage = errorData.message || 'Resource not found.';
      }
      
      const error = new Error(errorMessage);
      error.status = response.status;
      error.response = response;
      error.details = errorData.details; // Include any additional details from the API
      
      throw error;
    }
    
    return await safeJsonParse(response);
  } catch (error) {
    console.error('[Fetch JSON Error]', error);
    throw error;
  }
}

/**
 * Create a timeout controller with proper cleanup
 * @param {number} timeout - Timeout in milliseconds
 * @param {AbortController} controller - The abort controller
 * @returns {number|null} - Timeout ID or null
 */
function createTimeoutController(timeout, controller) {
  if (!timeout || timeout <= 0) return null;
  
  return setTimeout(() => {
    if (controller && !controller.signal.aborted) {
      controller.abort(new Error('Request timeout'));
    }
  }, timeout);
}

/**
 * Clear timeout safely
 * @param {number|null} timeoutId - The timeout ID to clear
 * @returns {null} - Always returns null for easy assignment
 */
function clearTimeoutSafely(timeoutId) {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  return null;
}

/**
 * Check and warn about browser settings that might cause SSL issues
 */
function checkBrowserSSLSettings() {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return;
  }
  
  // Check if the current page is loaded over HTTPS when it should be HTTP
  if (window.location.protocol === 'https:' && window.location.hostname === 'localhost') {
    console.warn('⚠️ [Browser Warning] Your browser is forcing HTTPS for localhost.');
    console.warn('This can cause SSL errors. Consider:');
    console.warn('1. Typing "http://localhost:3000" directly in the address bar');
    console.warn('2. Clearing browser data for localhost');
    console.warn('3. Disabling "Always use secure connections" for localhost');
    
    // Try to redirect to HTTP if possible
    if (window.location.href.startsWith('https://localhost')) {
      const httpUrl = window.location.href.replace('https://', 'http://');
      console.warn(`4. Or click here to switch to HTTP: ${httpUrl}`);
    }
  }
}

// Run the check when the module loads
if (typeof window !== 'undefined') {
  // Delay the check to ensure the page is fully loaded
  setTimeout(checkBrowserSSLSettings, 1000);
}