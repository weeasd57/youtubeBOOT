'use client';

import { createContext, useContext } from 'react';

// Create context
const ToastContext = createContext();

// Toast types (kept for compatibility)
export const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

// Toast provider component that does nothing
export function ToastProvider({ children }) {
  // No-op functions
  const addToast = () => null;
  const removeToast = () => null;

  const value = {
    addToast,
    removeToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

// Custom hook that does nothing
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Empty helper functions for compatibility
export const toast = {
  success: () => null,
  error: () => null,
  warning: () => null,
  info: () => null,
}; 