/**
 * Enhanced error handling hook with logging and user feedback
 */

import { useCallback, useState } from 'react';
import { toast } from 'react-hot-toast';

// Error types for better categorization
export const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  AUTHENTICATION: 'AUTH_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  SERVER: 'SERVER_ERROR',
  CLIENT: 'CLIENT_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

// Error severity levels
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Default error messages for different types
const DEFAULT_ERROR_MESSAGES = {
  [ERROR_TYPES.NETWORK]: 'Network connection failed. Please check your internet connection.',
  [ERROR_TYPES.AUTHENTICATION]: 'Authentication failed. Please sign in again.',
  [ERROR_TYPES.AUTHORIZATION]: 'You do not have permission to perform this action.',
  [ERROR_TYPES.VALIDATION]: 'Please check your input and try again.',
  [ERROR_TYPES.SERVER]: 'Server error occurred. Please try again later.',
  [ERROR_TYPES.CLIENT]: 'An unexpected error occurred.',
  [ERROR_TYPES.UNKNOWN]: 'Something went wrong. Please try again.'
};

// Error classification helper
const classifyError = (error) => {
  if (!error) return { type: ERROR_TYPES.UNKNOWN, severity: ERROR_SEVERITY.LOW };

  const status = error.status || error.response?.status;
  const message = error.message || error.toString();

  // Network errors
  if (error.name === 'NetworkError' || message.includes('fetch')) {
    return { type: ERROR_TYPES.NETWORK, severity: ERROR_SEVERITY.MEDIUM };
  }

  // HTTP status code based classification
  if (status) {
    if (status === 401) {
      return { type: ERROR_TYPES.AUTHENTICATION, severity: ERROR_SEVERITY.HIGH };
    }
    if (status === 403) {
      return { type: ERROR_TYPES.AUTHORIZATION, severity: ERROR_SEVERITY.HIGH };
    }
    if (status >= 400 && status < 500) {
      return { type: ERROR_TYPES.CLIENT, severity: ERROR_SEVERITY.MEDIUM };
    }
    if (status >= 500) {
      return { type: ERROR_TYPES.SERVER, severity: ERROR_SEVERITY.HIGH };
    }
  }

  // Validation errors
  if (message.includes('validation') || message.includes('invalid')) {
    return { type: ERROR_TYPES.VALIDATION, severity: ERROR_SEVERITY.LOW };
  }

  return { type: ERROR_TYPES.UNKNOWN, severity: ERROR_SEVERITY.MEDIUM };
};

// Error logging utility
const logError = (error, context = {}) => {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      status: error.status || error.response?.status
    },
    context,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    url: typeof window !== 'undefined' ? window.location.href : 'server'
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error logged:', errorInfo);
  }

  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to Sentry, LogRocket, or other error tracking service
    // Sentry.captureException(error, { extra: errorInfo });
  }
};

// Main error handler hook
export const useErrorHandler = (options = {}) => {
  const {
    showToast = true,
    logErrors = true,
    customMessages = {},
    onError = null
  } = options;

  const [errors, setErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Handle error function
  const handleError = useCallback((error, context = {}) => {
    const { type, severity } = classifyError(error);
    
    const errorData = {
      id: Date.now() + Math.random(),
      error,
      type,
      severity,
      context,
      timestamp: new Date().toISOString()
    };

    // Add to errors state
    setErrors(prev => [...prev.slice(-9), errorData]); // Keep last 10 errors

    // Log error if enabled
    if (logErrors) {
      logError(error, { ...context, type, severity });
    }

    // Show toast notification if enabled
    if (showToast) {
      const message = customMessages[type] || DEFAULT_ERROR_MESSAGES[type];
      
      switch (severity) {
        case ERROR_SEVERITY.CRITICAL:
        case ERROR_SEVERITY.HIGH:
          toast.error(message, { duration: 6000 });
          break;
        case ERROR_SEVERITY.MEDIUM:
          toast.error(message, { duration: 4000 });
          break;
        case ERROR_SEVERITY.LOW:
          toast(message, { duration: 3000 });
          break;
        default:
          toast.error(message);
      }
    }

    // Call custom error handler if provided
    if (onError && typeof onError === 'function') {
      onError(errorData);
    }

    return errorData;
  }, [showToast, logErrors, customMessages, onError]);

  // Async operation wrapper with error handling
  const withErrorHandling = useCallback((asyncFn, context = {}) => {
    return async (...args) => {
      setIsLoading(true);
      try {
        const result = await asyncFn(...args);
        setIsLoading(false);
        return result;
      } catch (error) {
        setIsLoading(false);
        handleError(error, context);
        throw error; // Re-throw to allow caller to handle if needed
      }
    };
  }, [handleError]);

  // Clear specific error
  const clearError = useCallback((errorId) => {
    setErrors(prev => prev.filter(err => err.id !== errorId));
  }, []);

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Get errors by type
  const getErrorsByType = useCallback((type) => {
    return errors.filter(err => err.type === type);
  }, [errors]);

  // Get errors by severity
  const getErrorsBySeverity = useCallback((severity) => {
    return errors.filter(err => err.severity === severity);
  }, [errors]);

  // Check if there are critical errors
  const hasCriticalErrors = useCallback(() => {
    return errors.some(err => err.severity === ERROR_SEVERITY.CRITICAL);
  }, [errors]);

  return {
    // Error handling
    handleError,
    withErrorHandling,
    
    // Error state
    errors,
    isLoading,
    hasCriticalErrors: hasCriticalErrors(),
    
    // Error management
    clearError,
    clearAllErrors,
    getErrorsByType,
    getErrorsBySeverity,
    
    // Utilities
    ERROR_TYPES,
    ERROR_SEVERITY
  };
};

// Specialized hooks for common error scenarios
export const useApiErrorHandler = () => {
  return useErrorHandler({
    customMessages: {
      [ERROR_TYPES.NETWORK]: 'Unable to connect to the server. Please check your internet connection.',
      [ERROR_TYPES.SERVER]: 'Server is temporarily unavailable. Please try again in a few minutes.',
      [ERROR_TYPES.AUTHENTICATION]: 'Your session has expired. Please sign in again.',
      [ERROR_TYPES.AUTHORIZATION]: 'You do not have permission to access this resource.'
    }
  });
};

export const useFormErrorHandler = () => {
  return useErrorHandler({
    showToast: false, // Forms usually show inline errors
    customMessages: {
      [ERROR_TYPES.VALIDATION]: 'Please correct the highlighted fields and try again.'
    }
  });
};

export const useUploadErrorHandler = () => {
  return useErrorHandler({
    customMessages: {
      [ERROR_TYPES.NETWORK]: 'Upload failed due to network issues. Please try again.',
      [ERROR_TYPES.SERVER]: 'Upload server is busy. Please try again later.',
      [ERROR_TYPES.VALIDATION]: 'File format or size is not supported.'
    }
  });
};

// Error boundary hook for React components
export const useErrorBoundary = () => {
  const [error, setError] = useState(null);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const captureError = useCallback((error, errorInfo) => {
    setError({ error, errorInfo });
    logError(error, errorInfo);
  }, []);

  return {
    error,
    resetError,
    captureError,
    hasError: !!error
  };
};

export default useErrorHandler;