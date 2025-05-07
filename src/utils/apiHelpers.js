/**
 * Utility functions for API calls
 */

/**
 * Executes a function with exponential backoff retry logic
 * @param {Function} fn - The async function to execute
 * @param {Object} options - Configuration options
 * @param {Number} options.maxRetries - Maximum number of retry attempts (default: 3)
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
      
      // Don't retry if we've hit max retries or if shouldRetry returns false
      if (retries >= maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      // Calculate exponential backoff with jitter
      const delay = Math.min(
        maxDelay,
        initialDelay * Math.pow(2, retries) * (0.5 + Math.random() * 0.5)
      );
      
      // Call onRetry callback with relevant information
      onRetry({
        error,
        retryCount: retries + 1,
        delay,
        maxRetries
      });
      
      // Wait for the backoff period
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Increment retry counter
      retries++;
    }
  }
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