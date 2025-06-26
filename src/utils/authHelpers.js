/**
 * Authentication helpers for handling session management and token refresh
 */

import { signIn, signOut, getSession } from 'next-auth/react';

/**
 * Check if error is authentication related
 * @param {Error|Object} error - Error object or response
 * @returns {boolean} - True if it's an auth error
 */
export function isAuthenticationError(error) {
  // Check for 401 status code
  if (error?.status === 401 || error?.response?.status === 401) {
    return true;
  }
  
  // Check for common auth error messages
  const authMessages = [
    'unauthorized',
    'you must be logged in',
    'authentication required',
    'invalid token',
    'token expired',
    'session expired'
  ];
  
  const errorMessage = (error?.message || error?.error || '').toLowerCase();
  return authMessages.some(msg => errorMessage.includes(msg));
}

/**
 * Attempt to refresh the current session
 * @returns {Promise<boolean>} - True if refresh was successful
 */
export async function refreshSession() {
  try {
    console.log('[Auth] Attempting to refresh session...');
    
    // Try to get current session
    const session = await getSession();
    
    if (!session) {
      console.log('[Auth] No session found, cannot refresh');
      return false;
    }
    
    // Force session refresh by calling the session endpoint
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (response.ok) {
      const newSession = await response.json();
      console.log('[Auth] Session refreshed successfully');
      return !!newSession?.user;
    }
    
    console.log('[Auth] Session refresh failed');
    return false;
  } catch (error) {
    console.error('[Auth] Error refreshing session:', error);
    return false;
  }
}

/**
 * Handle authentication errors with automatic retry
 * @param {Error} error - The authentication error
 * @param {Function} retryCallback - Function to retry after auth fix
 * @returns {Promise<any>} - Result of retry or error
 */
export async function handleAuthError(error, retryCallback = null) {
  console.log('[Auth] Handling authentication error:', error.message);
  
  // First, try to refresh the session
  const refreshSuccess = await refreshSession();
  
  if (refreshSuccess && retryCallback) {
    console.log('[Auth] Session refreshed, retrying original request...');
    try {
      return await retryCallback();
    } catch (retryError) {
      console.log('[Auth] Retry after refresh failed:', retryError.message);
      // If retry fails, continue with sign-out flow
    }
  }
  
  // If refresh failed or retry failed, sign out and redirect
  console.log('[Auth] Session refresh failed, signing out...');
  
  // Show user-friendly message
  if (typeof window !== 'undefined') {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f59e0b;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 350px;
    `;
    
    notification.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">🔐 Session Expired</div>
      <div>Your session has expired. Please sign in again.</div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }
  
  // Sign out and redirect to home
  await signOut({ callbackUrl: '/' });
  
  throw error; // Re-throw for caller to handle
}

/**
 * Enhanced fetch wrapper with automatic auth error handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {Object} authOptions - Auth handling options
 * @returns {Promise<Response>} - Fetch response
 */
export async function fetchWithAuth(url, options = {}, authOptions = {}) {
  const { 
    maxAuthRetries = 1,
    autoSignOut = true,
    showNotification = true 
  } = authOptions;
  
  let authRetries = 0;
  
  const attemptFetch = async () => {
    try {
      const response = await fetch(url, {
        credentials: 'include', // Always include cookies
        ...options
      });
      
      // If we get 401, handle auth error
      if (response.status === 401 && authRetries < maxAuthRetries) {
        authRetries++;
        console.log(`[Auth] Got 401, attempting auth retry ${authRetries}/${maxAuthRetries}`);
        
        const refreshSuccess = await refreshSession();
        if (refreshSuccess) {
          // Retry the original request
          return await fetch(url, {
            credentials: 'include',
            ...options
          });
        }
      }
      
      return response;
    } catch (error) {
      // Handle network errors that might be auth-related
      if (isAuthenticationError(error) && authRetries < maxAuthRetries) {
        authRetries++;
        console.log(`[Auth] Network auth error, attempting retry ${authRetries}/${maxAuthRetries}`);
        
        const refreshSuccess = await refreshSession();
        if (refreshSuccess) {
          return await fetch(url, {
            credentials: 'include',
            ...options
          });
        }
      }
      
      throw error;
    }
  };
  
  try {
    const response = await attemptFetch();
    
    // If still 401 after retries and auto sign out is enabled
    if (response.status === 401 && autoSignOut) {
      const error = new Error('You must be logged in to access this endpoint');
      error.status = 401;
      await handleAuthError(error);
    }
    
    return response;
  } catch (error) {
    // Handle auth errors
    if (isAuthenticationError(error) && autoSignOut) {
      await handleAuthError(error);
    }
    
    throw error;
  }
}

/**
 * Check if user is properly authenticated
 * @returns {Promise<boolean>} - True if authenticated
 */
export async function checkAuthentication() {
  try {
    const session = await getSession();
    return !!session?.user;
  } catch (error) {
    console.error('[Auth] Error checking authentication:', error);
    return false;
  }
}

/**
 * Get current user session with error handling
 * @returns {Promise<Object|null>} - Session object or null
 */
export async function getCurrentSession() {
  try {
    return await getSession();
  } catch (error) {
    console.error('[Auth] Error getting session:', error);
    return null;
  }
}

/**
 * Sign in with automatic error handling
 * @param {string} provider - Auth provider (e.g., 'google')
 * @param {Object} options - Sign in options
 * @returns {Promise<Object>} - Sign in result
 */
export async function signInWithErrorHandling(provider = 'google', options = {}) {
  try {
    const result = await signIn(provider, {
      redirect: false,
      ...options
    });
    
    if (result?.error) {
      console.error('[Auth] Sign in error:', result.error);
      throw new Error(result.error);
    }
    
    return result;
  } catch (error) {
    console.error('[Auth] Sign in failed:', error);
    throw error;
  }
}

/**
 * Initialize auth error handling for the app
 */
export function initializeAuthErrorHandling() {
  if (typeof window === 'undefined') return;
  
  // Listen for auth errors globally
  window.addEventListener('unhandledrejection', (event) => {
    if (isAuthenticationError(event.reason)) {
      console.log('[Auth] Caught unhandled auth error:', event.reason);
      event.preventDefault(); // Prevent default error handling
      handleAuthError(event.reason);
    }
  });
  
  // Listen for storage events (sign out from another tab)
  window.addEventListener('storage', (event) => {
    if (event.key === 'nextauth.message') {
      try {
        const message = JSON.parse(event.newValue || '{}');
        if (message.event === 'session' && !message.data) {
          console.log('[Auth] Session ended in another tab');
          // Optionally reload the page or show notification
          window.location.reload();
        }
      } catch (error) {
        // Ignore JSON parse errors
      }
    }
  });
  
  console.log('[Auth] Auth error handling initialized');
}