/**
 * API utility functions for making fetch requests with better error handling
 */

/**
 * Make a fetch request with proper error handling
 * 
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @param {Function} onSuccess - Success callback
 * @param {Function} onError - Error callback
 * @returns {Promise<any>} - The response data
 */
export async function fetchWithErrorHandling(url, options = {}, onSuccess, onError) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(
        data.message || data.error || `Request failed with status ${response.status}`
      );
      error.status = response.status;
      error.data = data;
      
      if (onError) {
        onError(error);
      }
      
      throw error;
    }

    if (onSuccess) {
      onSuccess(data);
    }
    
    return data;
  } catch (error) {
    if (!error.status) {
      // Network error
      error.message = error.message || 'Network error. Please check your connection.';
    }
    
    if (onError) {
      onError(error);
    }
    
    throw error;
  }
}

/**
 * Make a GET request
 * 
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @param {Function} onSuccess - Success callback
 * @param {Function} onError - Error callback
 * @returns {Promise<any>} - The response data
 */
export async function get(url, options = {}, onSuccess, onError) {
  return fetchWithErrorHandling(
    url, 
    { ...options, method: 'GET' },
    onSuccess,
    onError
  );
}

/**
 * Make a POST request
 * 
 * @param {string} url - The URL to fetch
 * @param {Object} data - The data to send
 * @param {Object} options - Fetch options
 * @param {Function} onSuccess - Success callback
 * @param {Function} onError - Error callback
 * @returns {Promise<any>} - The response data
 */
export async function post(url, data = {}, options = {}, onSuccess, onError) {
  return fetchWithErrorHandling(
    url,
    {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    },
    onSuccess,
    onError
  );
}

/**
 * Make a PUT request
 * 
 * @param {string} url - The URL to fetch
 * @param {Object} data - The data to send
 * @param {Object} options - Fetch options
 * @param {Function} onSuccess - Success callback
 * @param {Function} onError - Error callback
 * @returns {Promise<any>} - The response data
 */
export async function put(url, data = {}, options = {}, onSuccess, onError) {
  return fetchWithErrorHandling(
    url,
    {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    },
    onSuccess,
    onError
  );
}

/**
 * Make a DELETE request
 * 
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @param {Function} onSuccess - Success callback
 * @param {Function} onError - Error callback
 * @returns {Promise<any>} - The response data
 */
export async function del(url, options = {}, onSuccess, onError) {
  return fetchWithErrorHandling(
    url,
    {
      ...options,
      method: 'DELETE',
    },
    onSuccess,
    onError
  );
}

/**
 * Check if an error is an authentication error
 * 
 * @param {Error} error - The error to check
 * @returns {boolean} - Whether the error is an authentication error
 */
export function isAuthError(error) {
  return error.status === 401 || error.status === 403;
}

/**
 * Check if an error is a network error
 * 
 * @param {Error} error - The error to check
 * @returns {boolean} - Whether the error is a network error
 */
export function isNetworkError(error) {
  return !error.status && error.message.includes('Network');
}

/**
 * Get a user-friendly error message
 * 
 * @param {Error} error - The error to get a message for
 * @returns {string} - A user-friendly error message
 */
export function getUserFriendlyErrorMessage(error) {
  if (isAuthError(error)) {
    return 'Authentication error. Please sign in again.';
  }
  
  if (isNetworkError(error)) {
    return 'Network error. Please check your connection.';
  }
  
  return error.message || 'An unexpected error occurred.';
} 