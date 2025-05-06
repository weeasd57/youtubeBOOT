'use client';

import { useState } from 'react';
import { FaExclamationTriangle, FaSync } from 'react-icons/fa';
import { signOut } from 'next-auth/react';
import { useDrive } from '@/contexts/DriveContext';

export default function AuthErrorBanner({ message }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { handleAuthError } = useDrive();
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    const success = await handleAuthError();
    setIsRefreshing(false);
    
    if (!success) {
      // If refresh failed, sign out
      signOut({ callbackUrl: '/' });
    }
  };
  
  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };
  
  return (
    <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-md">
      <div className="flex items-center gap-2 mb-2">
        <FaExclamationTriangle className="text-red-500" />
        <h3 className="font-medium">Authentication Error</h3>
      </div>
      <p className="mb-3">{message || 'Failed to fetch files from Google Drive: Invalid Credentials'}</p>
      <div className="flex gap-3">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-3 py-1.5 bg-blue-600 text-white rounded flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50"
        >
          <FaSync className={isRefreshing ? 'animate-spin' : ''} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh Session'}</span>
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