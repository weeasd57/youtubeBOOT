'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { FaCheck, FaTimes, FaExclamationTriangle, FaInfo } from 'react-icons/fa';

// Create context
const ToastContext = createContext();

// Toast types
export const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

// Toast component
function Toast({ message, type, onClose, duration = 5000 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  // Determine icon and styling based on type
  let icon;
  let bgColor;
  let textColor;
  let borderColor;

  switch (type) {
    case TOAST_TYPES.SUCCESS:
      icon = <FaCheck />;
      bgColor = 'bg-green-100 dark:bg-green-900/30';
      textColor = 'text-green-800 dark:text-green-300';
      borderColor = 'border-green-500 dark:border-green-600';
      break;
    case TOAST_TYPES.ERROR:
      icon = <FaTimes />;
      bgColor = 'bg-red-100 dark:bg-red-900/30';
      textColor = 'text-red-800 dark:text-red-300';
      borderColor = 'border-red-500 dark:border-red-600';
      break;
    case TOAST_TYPES.WARNING:
      icon = <FaExclamationTriangle />;
      bgColor = 'bg-amber-100 dark:bg-amber-900/30';
      textColor = 'text-amber-800 dark:text-amber-300';
      borderColor = 'border-amber-500 dark:border-amber-600';
      break;
    case TOAST_TYPES.INFO:
    default:
      icon = <FaInfo />;
      bgColor = 'bg-blue-100 dark:bg-blue-900/30';
      textColor = 'text-blue-800 dark:text-blue-300';
      borderColor = 'border-blue-500 dark:border-blue-600';
      break;
  }

  return (
    <div className={`flex items-center p-4 mb-4 text-sm rounded-lg border ${bgColor} ${textColor} ${borderColor} shadow-md`}>
      <div className="mr-3 flex-shrink-0">{icon}</div>
      <div className="flex-1">{message}</div>
      <button
        type="button"
        className={`ml-3 inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-opacity-30 hover:bg-gray-700 focus:outline-none`}
        onClick={onClose}
        aria-label="Close"
      >
        <FaTimes className="w-3 h-3" />
      </button>
    </div>
  );
}

// Toast provider component
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = TOAST_TYPES.INFO, duration = 5000) => {
    const id = Date.now();
    setToasts((prevToasts) => [...prevToasts, { id, message, type, duration }]);
    return id;
  };

  const removeToast = (id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  };

  const value = {
    addToast,
    removeToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 max-w-md">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Custom hook to use toast
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// DO NOT use these direct helper functions - they use hooks and can cause mounting issues
// Instead use the ToastHelper class from @/components/ToastHelper.js
/* 
// Helper functions to show different types of toasts
export const toast = {
  success: (message, duration) => {
    const { addToast } = useToast();
    return addToast(message, TOAST_TYPES.SUCCESS, duration);
  },
  error: (message, duration) => {
    const { addToast } = useToast();
    return addToast(message, TOAST_TYPES.ERROR, duration);
  },
  warning: (message, duration) => {
    const { addToast } = useToast();
    return addToast(message, TOAST_TYPES.WARNING, duration);
  },
  info: (message, duration) => {
    const { addToast } = useToast();
    return addToast(message, TOAST_TYPES.INFO, duration);
  },
}; 
*/ 