'use client';

import React, { useState, useEffect } from 'react';
import ErrorDisplay from './ErrorDisplay';

/**
 * A component to handle API errors and provide fallback UI
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {boolean} props.loading - Whether the API is loading
 * @param {string} props.error - Error message from the API
 * @param {Function} props.onRetry - Function to retry the API call
 * @param {React.ReactNode} props.fallback - Fallback UI to show when there's an error
 * @returns {JSX.Element} - The API error boundary component
 */
export default function ApiErrorBoundary({
  children,
  loading = false,
  error = null,
  onRetry = null,
  fallback = null
}) {
  const [dismissed, setDismissed] = useState(false);
  
  // Reset dismissed state when error changes
  useEffect(() => {
    if (error) {
      setDismissed(false);
    }
  }, [error]);

  if (loading) {
    return children;
  }

  if (error && !dismissed) {
    return (
      <>
        <ErrorDisplay 
          message={error}
          onRetry={onRetry}
          dismissible={true}
          onDismiss={() => setDismissed(true)}
        />
        {fallback || children}
      </>
    );
  }

  return children;
} 