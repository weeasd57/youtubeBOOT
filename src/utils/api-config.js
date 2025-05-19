/**
 * Centralized API configuration settings
 * This file contains settings for API requests, timeouts, and retry logic
 */

// Base timeouts for different API types (in milliseconds)
export const API_TIMEOUTS = {
  DRIVE: 60000,        // 60 seconds for Google Drive operations
  YOUTUBE: 60000,      // 60 seconds for YouTube operations
  TIKTOK: 45000,       // 45 seconds for TikTok operations
  DEFAULT: 30000,      // 30 seconds default
  SHORT: 15000,        // 15 seconds for quick operations
};

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 5,      // Maximum number of retry attempts
  BASE_DELAY: 1000,    // Starting delay in milliseconds
  MAX_DELAY: 30000,    // Maximum delay between retries
  BACKOFF_FACTOR: 1.5, // Exponential backoff multiplier
};

// Retry status codes
export const RETRY_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests (rate limited)
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

// Check if error is retryable
export function isRetryableError(error) {
  // Network errors and timeouts
  const isNetworkError = !error.response && !error.status && error.code !== 'ECONNABORTED';
  
  // Timeout errors
  const isTimeout = (
    error.code === 'ECONNABORTED' ||
    error.name === 'TimeoutError' ||
    error.message?.includes('timeout')
  );

  // Rate limit errors
  const isRateLimit = error.response?.status === 429;
  
  // Server errors
  const isServerError = 
    error.response?.status >= 500 && 
    error.response?.status < 600;

  return isNetworkError || isTimeout || isRateLimit || isServerError;
}

// Calculate retry delay with exponential backoff
export function calculateRetryDelay(attempt) {
  const { BASE_DELAY, MAX_DELAY, BACKOFF_FACTOR } = RETRY_CONFIG;
  const delay = Math.min(
    BASE_DELAY * Math.pow(BACKOFF_FACTOR, attempt),
    MAX_DELAY
  );
  
  // Add some randomness to prevent all retries happening simultaneously
  return delay * (0.8 + Math.random() * 0.4);
}

// Default axios request config
export const DEFAULT_REQUEST_CONFIG = {
  timeout: API_TIMEOUTS.DEFAULT,
  headers: {
    'Content-Type': 'application/json',
  },
  validateStatus: status => status >= 200 && status < 300,
}; 