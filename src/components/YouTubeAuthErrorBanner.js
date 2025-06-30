'use client';

import { useState } from 'react';
import { FaExclamationTriangle, FaSync, FaYoutube, FaPlus } from 'react-icons/fa';
import { signOut } from 'next-auth/react';
import { useUser } from '@/contexts/UserContext';

export default function YouTubeAuthErrorBanner({ 
  message, 
  accountId,
  needsReconnect = false,
  onRetry = null
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { accounts, refreshAccounts } = useUser();
  
  // Find the account that has the error
  const account = accounts?.find(acc => acc.id === accountId);
  
  const handleRefresh = async () => {
    if (onRetry) {
      setIsRefreshing(true);
      try {
        await onRetry();
        // Also refresh accounts to get updated status
        await refreshAccounts();
      } catch (error) {
        console.error('Retry failed:', error);
      } finally {
        setIsRefreshing(false);
      }
    }
  };
  
  const handleReconnect = () => {
    // Redirect to add account page with the specific account for reconnection
    const reconnectUrl = `/api/auth/signin/google?callbackUrl=${encodeURIComponent(window.location.href)}&addingFor=${accountId}`;
    window.location.href = reconnectUrl;
  };
  
  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };
  
  // If this is a token/credentials error that needs reconnection
  if (needsReconnect) {
    return (
      <div className="mb-4 p-4 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 rounded-md border border-orange-300 dark:border-orange-800/50">
        <div className="flex items-center gap-2 mb-2">
          <FaYoutube className="text-red-500" />
          <h3 className="font-medium">YouTube Access Expired</h3>
        </div>
        <p className="mb-3">
          {message || `Your YouTube access for ${account?.email || 'this account'} has expired or been revoked. Please reconnect your account to continue.`}
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleReconnect}
            className="px-3 py-1.5 bg-red-600 text-white rounded flex items-center gap-1 hover:bg-red-700"
          >
            <FaPlus />
            <span>Reconnect YouTube</span>
          </button>
          {onRetry && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 bg-blue-600 text-white rounded flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50"
            >
              <FaSync className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Retrying...' : 'Retry'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }
  
  // General authentication error
  return (
    <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-md border border-red-300 dark:border-red-800/50">
      <div className="flex items-center gap-2 mb-2">
        <FaExclamationTriangle className="text-red-500" />
        <h3 className="font-medium">YouTube Authentication Error</h3>
      </div>
      <p className="mb-3">
        {message || `Failed to authenticate with YouTube for ${account?.email || 'this account'}. This may be due to expired credentials or revoked access.`}
      </p>
      
      <div className="flex gap-3">
        {onRetry && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 bg-blue-600 text-white rounded flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50"
          >
            <FaSync className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Retrying...' : 'Retry'}</span>
          </button>
        )}
        <button
          onClick={handleReconnect}
          className="px-3 py-1.5 bg-red-600 text-white rounded flex items-center gap-1 hover:bg-red-700"
        >
          <FaPlus />
          <span>Reconnect Account</span>
        </button>
        <button
          onClick={handleSignOut}
          className="px-3 py-1.5 border border-red-500 text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}