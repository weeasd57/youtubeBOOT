'use client';

import React from 'react';
import { FaExclamationTriangle, FaSync } from 'react-icons/fa';

/**
 * A component to display API errors with retry functionality
 * 
 * @param {Object} props - Component props
 * @param {string} props.message - Error message to display
 * @param {Function} props.onRetry - Function to call when retry is clicked
 * @param {string} props.severity - Error severity (error, warning, info)
 * @param {boolean} props.dismissible - Whether the error can be dismissed
 * @param {Function} props.onDismiss - Function to call when dismiss is clicked
 * @returns {JSX.Element} - The error display component
 */
export default function ErrorDisplay({
  message = "An error occurred while processing your request.",
  onRetry,
  severity = "error",
  dismissible = false,
  onDismiss
}) {
  // Determine styling based on severity
  const severityStyles = {
    error: {
      container: "bg-red-100 border-l-4 border-red-500 text-red-700",
      icon: "text-red-500",
      button: "bg-red-600 hover:bg-red-700 text-white"
    },
    warning: {
      container: "bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700",
      icon: "text-yellow-500",
      button: "bg-yellow-600 hover:bg-yellow-700 text-white"
    },
    info: {
      container: "bg-blue-100 border-l-4 border-blue-500 text-blue-700",
      icon: "text-blue-500",
      button: "bg-blue-600 hover:bg-blue-700 text-white"
    }
  };

  const styles = severityStyles[severity] || severityStyles.error;

  return (
    <div className={`${styles.container} p-4 rounded-md my-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <FaExclamationTriangle className={`${styles.icon} mr-2`} />
          <p>{message}</p>
        </div>
        <div className="flex gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className={`${styles.button} px-3 py-1 rounded-md text-sm flex items-center gap-1`}
            >
              <FaSync className="text-xs" /> Retry
            </button>
          )}
          {dismissible && onDismiss && (
            <button
              onClick={onDismiss}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1 rounded-md text-sm"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 