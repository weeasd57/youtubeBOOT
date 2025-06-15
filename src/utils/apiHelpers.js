/**
 * Utility functions for API calls
 */
import { 
  API_TIMEOUTS, 
  RETRY_CONFIG, 
  RETRY_STATUS_CODES, 
  isRetryableError, 
  calculateRetryDelay 
} from './api-config';

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
  const urlObj = new URL(url, window.location.origin);
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
    const response = await fetch(url, options);
    
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
    console.error(`[API] Error fetching ${url}:`, error);
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
export async function withRetryFunction(fn, options = {}) {
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
  return withRetryFunction(fn, {
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
 * Determine if an error is due to a quota exceeded
 * @param {Error} error - The error to check
 * @returns {Boolean} - True if it's a quota error
 */
export function isAuthError(error) {
  return error.response?.status === 401 || 
         error.response?.status === 403;
}

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

  let delay = initialDelay;
  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    try {
      const controller = new AbortController();
      const timeoutId = options.timeout 
        ? setTimeout(() => controller.abort(new Error('Request timeout')), options.timeout) 
        : null;

      // Add the abort signal to our fetch options if not already present
      const fetchOptions = {
        ...options,
        signal: options.signal || controller.signal
      };

      const response = await fetch(url, fetchOptions);

      // Clear the timeout if we have one
      if (timeoutId) clearTimeout(timeoutId);

      // If we get a status code we should retry on
      if (retryOnStatus.includes(response.status) && attempt < maxRetries) {
        attempt++;
        lastError = new Error(`Received status ${response.status}`);
        
        // Log the retry attempt
        console.warn(`API call to ${url} failed with status ${response.status}. Retrying (${attempt}/${maxRetries})...`);
        
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
      if (options.timeoutId) clearTimeout(options.timeoutId);

      // Determine if it's a timeout, network error, or abort we should retry on
      const isNetworkError = (
        error.name === 'TypeError' || 
        error.message?.includes('network') ||
        error.message?.includes('fetch') ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED'
      );
      
      const isTimeout = (
        error.name === 'AbortError' || 
        error.name === 'TimeoutError' || 
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('timeout')
      );

      // If this is not a network error or timeout or we've used all our retries, throw the error
      if ((!isNetworkError && !isTimeout) || !retryOnNetworkError || attempt >= maxRetries) {
        throw error;
      }

      attempt++;
      
      // Log the retry attempt
      console.warn(`API call to ${url} failed with error: ${error.message}. Retrying (${attempt}/${maxRetries})...`);
      
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