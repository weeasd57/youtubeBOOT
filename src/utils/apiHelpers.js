/**
 * Utility functions for API calls
 */

/**
 * Executes a function with exponential backoff retry logic
 * @param {Function} fn - The async function to execute
 * @param {Object} options - Configuration options
 * @param {Number} options.maxRetries - Maximum number of retry attempts (default: 3, use -1 for infinite retries)
 * @param {Number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {Number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {Function} options.shouldRetry - Function that determines if retry should happen (default: retry on all errors)
 * @param {Function} options.onRetry - Callback function when a retry occurs
 * @returns {Promise} - Result of the function execution
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
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