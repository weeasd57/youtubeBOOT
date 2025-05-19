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
 * Determine if an error is due to authentication issues
 * @param {Error} error - The error to check
 * @returns {Boolean} - True if it's an authentication error
 */
export function isAuthError(error) {
  if (!error) return false;
  
  // Check for common auth error status codes
  const statusCode = error.status || error.code || error.response?.status || 0;
  const hasAuthStatusCode = statusCode === 401 || statusCode === 403;
  
  // Check for auth error messages
  const errorMessage = (error.message || '').toLowerCase();
  const hasAuthInMessage = errorMessage.includes('auth') || 
                          errorMessage.includes('unauthorized') ||
                          errorMessage.includes('unauthenticated') ||
                          errorMessage.includes('invalid_grant') ||
                          errorMessage.includes('invalid credentials');
  
  // Check for auth error in Google API error details
  const errors = error.errors || (error.response?.data?.error?.errors) || [];
  const hasAuthError = errors.some(err => 
    err.reason === 'authError' || 
    (err.message && (
      err.message.toLowerCase().includes('auth') ||
      err.message.toLowerCase().includes('credentials')
    ))
  );
  
  return hasAuthStatusCode || hasAuthInMessage || hasAuthError;
}

/**
 * Creates a retry loop that runs until successful or explicitly stopped
 * @param {Function} fn - The async function to execute on each retry
 * @param {Object} options - Configuration options
 * @returns {Object} - Control methods: start(), stop(), isRunning()
 */
export function createPersistentRetry(fn, options = {}) {
  const {
    initialDelay = 5000,
    maxDelay = 60000,
    onSuccess = () => {},
    onError = () => {},
    onRetry = () => {},
    getDelayMultiplier = () => 1,
  } = options;
  
  let isRunning = false;
  let retryCount = 0;
  let timeoutId = null;
  
  const stop = () => {
    isRunning = false;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  const retry = async () => {
    if (!isRunning) return;
    
    try {
      const result = await fn();
      onSuccess(result);
      stop(); // Stop retrying on success
      return result;
    } catch (error) {
      retryCount++;
      onError(error, retryCount);
      
      if (isRunning) {
        // Calculate next delay with exponential backoff and jitter
        const multiplier = getDelayMultiplier(error) || 1;
        const baseDelay = Math.min(
          maxDelay,
          initialDelay * Math.pow(1.5, Math.min(retryCount, 12)) * multiplier
        );
        const delay = baseDelay * (0.75 + Math.random() * 0.5); // Add jitter (±25%)
        
        onRetry({
          error,
          retryCount,
          delay,
          nextAttemptTime: new Date(Date.now() + delay)
        });
        
        // Schedule next retry
        timeoutId = setTimeout(retry, delay);
      }
    }
  };
  
  const start = () => {
    if (isRunning) return;
    isRunning = true;
    retryCount = 0;
    retry();
  };
  
  return {
    start,
    stop,
    isRunning: () => isRunning
  };
}

// Generic API call function with retry logic
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
        ? setTimeout(() => controller.abort(), options.timeout) 
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