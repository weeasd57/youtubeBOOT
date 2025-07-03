'use client';

import React from 'react';
import Image from 'next/image';

/**
 * A fallback component to display during loading states
 * 
 * @param {Object} props - Component props
 * @param {string} props.message - Optional message to display
 * @param {boolean} props.fullScreen - Whether to display full screen
 * @param {boolean} props.showLogo - Whether to show the app logo
 * @param {number} props.size - Size of the spinner
 * @returns {JSX.Element} - The loading fallback component
 */
export default function LoadingFallback({ 
  message = 'Loading...', 
  fullScreen = false,
  showLogo = false,
  size = 10
}) {
  const containerClasses = fullScreen 
    ? "min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900"
    : "flex flex-col items-center justify-center p-4 min-h-[50vh]";

  return (
    <div className={containerClasses} suppressHydrationWarning>
      <div className="text-center">
        {showLogo && (
          <div className="relative w-16 h-16 mb-4 mx-auto">
            <Image 
              src="/android-chrome-192x192.png" 
              alt="App Logo"
              fill
              className="object-cover"
              priority={true}
            />
          </div>
        )}
        <div 
          className={`animate-spin rounded-full border-t-2 border-b-2 border-blue-600 mx-auto mb-4 h-${size} w-${size}`} 
          suppressHydrationWarning
        />
        <p className="text-slate-600 dark:text-slate-400 text-sm">{message}</p>
      </div>
    </div>
  );
} 