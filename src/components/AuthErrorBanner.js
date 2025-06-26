'use client';

import { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaSync, FaWifi } from 'react-icons/fa';
import { signOut } from 'next-auth/react';
import { useDrive } from '@/contexts/MultiDriveContext';

export default function AuthErrorBanner({ 
  message, 
  isNetworkError = false, 
  failureCount = 0, 
  maxFailures = 5,
  forceSignOut = false,
  isAccessRevoked = false
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { handleAuthError } = useDrive();
  
  // Auto refresh countdown for network errors
  useEffect(() => {
    let timer;
    if (isNetworkError && countdown > 0) {
      timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown, isNetworkError]);
  
  // Automatically start countdown if we have high failure count
  useEffect(() => {
    if (isNetworkError && failureCount > 1 && countdown === 0) {
      setCountdown(30 + (failureCount * 10)); // Increase wait time with failures
    }
  }, [isNetworkError, failureCount, countdown]);
  
  // للتسجيل الخروج التلقائي في حالة سحب الوصول
  useEffect(() => {
    if (isAccessRevoked) {
      const timer = setTimeout(() => {
        signOut({ callbackUrl: '/' });
      }, 5000); // تسجيل خروج بعد 5 ثوان
      
      return () => clearTimeout(timer);
    }
  }, [isAccessRevoked]);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    const success = await handleAuthError();
    setIsRefreshing(false);
    
    if (!success && isNetworkError) {
      // If refresh failed due to network error, set countdown for auto-retry
      setCountdown(30 + (failureCount * 10)); // Increase wait time with failures
    } else if (!success) {
      // If refresh failed for other reasons, sign out
      signOut({ callbackUrl: '/' });
    }
  };
  
  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };
  
  // حالة سحب الوصول
  if (isAccessRevoked) {
    return (
      <div className="mb-4 p-4 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 rounded-md border border-orange-300 dark:border-orange-800/50">
        <div className="flex items-center gap-2 mb-2">
          <FaExclamationTriangle className="text-orange-500" />
          <h3 className="font-medium">Access Revoked</h3>
        </div>
        <p className="mb-3">{message || 'Your access to Google has been revoked or expired. You will be redirected to sign in again.'}</p>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300">
            <FaSync className="animate-spin" size={14} />
            <span>Redirecting to sign in...</span>
          </div>
          <button
            onClick={handleSignOut}
            className="px-3 py-1.5 bg-orange-600 text-white rounded flex items-center gap-1 hover:bg-orange-700"
          >
            Sign Out Now
          </button>
        </div>
      </div>
    );
  }
  
  // If force sign out is true, show a different message
  if (forceSignOut) {
    return (
      <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-md border border-red-300 dark:border-red-800/50">
        <div className="flex items-center gap-2 mb-2">
          <FaExclamationTriangle className="text-red-500" />
          <h3 className="font-medium">Authentication Failure</h3>
        </div>
        <p className="mb-3">{message || 'Too many authentication failures. Signing you out...'}</p>
        <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <FaSync className="animate-spin" size={14} />
          <span>Signing out...</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`mb-4 p-4 rounded-md ${isNetworkError 
      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-800/50'
      : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-800/50'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {isNetworkError ? (
          <FaWifi className="text-yellow-500" />
        ) : (
          <FaExclamationTriangle className="text-red-500" />
        )}
        <h3 className="font-medium">
          {isNetworkError 
            ? `Network Connectivity Issue (${failureCount}/${maxFailures})`
            : 'Authentication Error'
          }
        </h3>
      </div>
      <p className="mb-3">{message || (isNetworkError 
        ? 'Unable to connect to Google servers. This may be due to a network issue or temporary outage.'
        : 'Failed to fetch files from Google Drive: Invalid Credentials'
      )}</p>
      
      {countdown > 0 ? (
        <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
          <FaSync className="animate-spin" size={14} />
          <span>Auto-retrying in {countdown} seconds...</span>
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`px-3 py-1.5 text-white rounded flex items-center gap-1 hover:bg-opacity-90 disabled:opacity-50 ${
              isNetworkError 
                ? 'bg-yellow-600 hover:bg-yellow-700' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <FaSync className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Session'}</span>
          </button>
          <button
            onClick={handleSignOut}
            className={`px-3 py-1.5 border rounded hover:bg-opacity-10 ${
              isNetworkError 
                ? 'border-yellow-500 text-yellow-600 dark:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20' 
                : 'border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
            }`}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
} 