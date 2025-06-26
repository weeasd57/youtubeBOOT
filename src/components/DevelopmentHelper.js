'use client';

import { useEffect } from 'react';

/**
 * Development helper component that only runs in development mode
 * Helps detect and resolve SSL/HTTPS issues
 */
export default function DevelopmentHelper() {
  useEffect(() => {
    // Only run in development and client-side
    if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') {
      return;
    }

    // Dynamic import to avoid including in production bundle
    import('@/utils/developmentHelpers').then(({ initDevelopmentHelpers }) => {
      initDevelopmentHelpers();
    }).catch(error => {
      console.warn('Failed to load development helpers:', error);
    });

    // Also initialize auth error handling
    import('@/utils/authHelpers').then(({ initializeAuthErrorHandling }) => {
      initializeAuthErrorHandling();
    }).catch(error => {
      console.warn('Failed to load auth helpers:', error);
    });
  }, []);

  // This component doesn't render anything
  return null;
}