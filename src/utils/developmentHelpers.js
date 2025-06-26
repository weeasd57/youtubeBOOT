/**
 * Development helpers for SSL and HTTPS issues
 * This file contains utilities to help developers resolve common SSL issues in development
 */

/**
 * Check if the current environment has SSL issues and provide solutions
 */
export function checkSSLIssues() {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return;
  }

  const issues = [];
  const solutions = [];

  // Check if running on HTTPS when should be HTTP
  if (window.location.protocol === 'https:' && window.location.hostname === 'localhost') {
    issues.push('🔒 Browser is forcing HTTPS for localhost');
    solutions.push('Navigate to http://localhost:3000 directly');
    solutions.push('Clear browser data for localhost');
    solutions.push('Disable "Always use secure connections" in browser settings');
  }

  // Check if there are mixed content warnings
  if (window.location.protocol === 'https:' && document.querySelectorAll('script[src^="http:"]').length > 0) {
    issues.push('⚠️ Mixed content detected (HTTPS page loading HTTP resources)');
    solutions.push('Ensure all resources use HTTPS or use relative URLs');
  }

  // Check browser-specific issues
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('chrome')) {
    solutions.push('Chrome: Go to chrome://net-internals/#hsts and delete localhost domain');
    solutions.push('Chrome: Disable "Secure DNS" in Privacy settings for development');
  } else if (userAgent.includes('firefox')) {
    solutions.push('Firefox: Set security.tls.insecure_fallback_hosts to localhost in about:config');
  } else if (userAgent.includes('safari')) {
    solutions.push('Safari: Disable "Fraudulent website warning" for localhost');
  }

  if (issues.length > 0) {
    console.group('🚨 SSL/HTTPS Issues Detected');
    console.warn('Issues found:');
    issues.forEach(issue => console.warn(`  • ${issue}`));
    console.info('Suggested solutions:');
    solutions.forEach(solution => console.info(`  ✓ ${solution}`));
    console.groupEnd();

    // Show user-friendly notification
    showSSLNotification(issues, solutions);
  }
}

/**
 * Show a user-friendly notification about SSL issues
 */
function showSSLNotification(issues, solutions) {
  // Create a notification element
  const notification = document.createElement('div');
  notification.id = 'ssl-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff6b6b;
    color: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.4;
  `;

  const httpUrl = window.location.href.replace('https://', 'http://');
  
  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px;">🔒 SSL Issue Detected</div>
    <div style="margin-bottom: 10px;">Your browser is using HTTPS for localhost, which can cause API errors.</div>
    <div style="margin-bottom: 10px;">
      <a href="${httpUrl}" style="color: #fff; text-decoration: underline;">
        Click here to switch to HTTP
      </a>
    </div>
    <button onclick="this.parentElement.remove()" style="
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    ">Dismiss</button>
  `;

  // Remove existing notification if present
  const existing = document.getElementById('ssl-notification');
  if (existing) {
    existing.remove();
  }

  document.body.appendChild(notification);

  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 10000);
}

/**
 * Force redirect to HTTP in development if on HTTPS
 */
export function forceHTTPInDevelopment() {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return;
  }

  if (window.location.protocol === 'https:' && window.location.hostname === 'localhost') {
    const httpUrl = window.location.href.replace('https://', 'http://');
    console.log('🔄 Redirecting to HTTP for development:', httpUrl);
    window.location.replace(httpUrl);
  }
}

/**
 * Add development-specific error handlers
 */
export function setupDevelopmentErrorHandlers() {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return;
  }

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('ERR_SSL_PROTOCOL_ERROR')) {
      console.error('🔒 SSL Error detected in promise rejection');
      console.error('This is likely due to HTTPS/HTTP mismatch in development');
      checkSSLIssues();
    }
  });

  // Handle fetch errors
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      return await originalFetch(...args);
    } catch (error) {
      if (error.message?.includes('ERR_SSL_PROTOCOL_ERROR')) {
        console.error('🔒 SSL Error in fetch request');
        console.error('URL:', args[0]);
        checkSSLIssues();
      }
      throw error;
    }
  };
}

/**
 * Check authentication status and provide debugging info
 */
function checkAuthenticationStatus() {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return;
  }

  // Check for NextAuth session
  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const session = await response.json();
      
      // Only show detailed logs if there are issues
      if (!session?.user || response.status !== 200) {
        console.group('🔐 Authentication Status');
        console.log('Session response status:', response.status);
        console.log('Session data:', session);
        
        if (!session?.user) {
          console.warn('⚠️ No authenticated user found');
          console.info('💡 If you expect to be logged in:');
          console.info('  • Check if you signed in properly');
          console.info('  • Clear browser cookies and sign in again');
          console.info('  • Check browser console for auth errors');
        }
        
        console.groupEnd();
      }
      // Silent success - no need to spam console when everything is working
      
    } catch (error) {
      console.group('🚨 Authentication Check Failed');
      console.error('Error checking session:', error);
      console.info('💡 This might indicate:');
      console.info('  • Network connectivity issues');
      console.info('  • Server authentication problems');
      console.info('  • CORS or cookie issues');
      console.groupEnd();
    }
  };

  // Check immediately and then every 5 minutes (reduced frequency)
  checkSession();
  // Only run periodic checks if there are authentication issues
  let hasAuthIssues = false;
  
  const periodicCheck = async () => {
    try {
      const response = await fetch('/api/auth/session');
      if (!response.ok || response.status !== 200) {
        hasAuthIssues = true;
        checkSession();
      } else if (hasAuthIssues) {
        // Reset flag if auth is working again
        hasAuthIssues = false;
        console.log('✅ Authentication issues resolved');
      }
    } catch (error) {
      hasAuthIssues = true;
      checkSession();
    }
  };
  
  // Check every 5 minutes instead of 30 seconds
  setInterval(periodicCheck, 5 * 60 * 1000);
}

/**
 * Initialize all development helpers
 */
export function initDevelopmentHelpers() {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return;
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        checkSSLIssues();
        checkAuthenticationStatus();
        setupDevelopmentErrorHandlers();
      }, 1000);
    });
  } else {
    setTimeout(() => {
      checkSSLIssues();
      checkAuthenticationStatus();
      setupDevelopmentErrorHandlers();
    }, 1000);
  }
}

// Auto-initialize when module is imported
initDevelopmentHelpers();