/**
 * Centralized API configuration settings
 * This file contains settings for API requests, timeouts, and retry logic
 */

// Base timeouts for different API types (in milliseconds)
// More generous timeouts in development
export const API_TIMEOUTS = {
  DRIVE: process.env.NODE_ENV === 'development' ? 120000 : 60000,        // 2 min dev, 1 min prod
  YOUTUBE: process.env.NODE_ENV === 'development' ? 120000 : 60000,      // 2 min dev, 1 min prod
  TIKTOK: process.env.NODE_ENV === 'development' ? 90000 : 45000,        // 1.5 min dev, 45s prod
  DEFAULT: process.env.NODE_ENV === 'development' ? 60000 : 30000,       // 1 min dev, 30s prod
  SHORT: process.env.NODE_ENV === 'development' ? 30000 : 15000,         // 30s dev, 15s prod
};

// Retry configuration - more lenient in development
export const RETRY_CONFIG = {
  MAX_RETRIES: process.env.NODE_ENV === 'development' ? 3 : 5,      // Fewer retries in dev for faster feedback
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