'use client';

import * as React from 'react';

function Badge({ className, variant = 'default', ...props }) {
  const variantStyles = {
    default: 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50',
    secondary: 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50',
    destructive: 'bg-red-100 text-red-900 dark:bg-red-900/20 dark:text-red-300',
    outline: 'text-gray-900 border border-gray-200 dark:text-gray-50 dark:border-gray-800',
    success: 'bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-300',
    info: 'bg-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-300',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2 dark:focus:ring-gray-300 ${variantStyles[variant] || variantStyles.default} ${className || ''}`}
      {...props}
    />
  );
}

export { Badge }; 