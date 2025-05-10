'use client';

import { useState } from 'react';
import { FaSync } from 'react-icons/fa';
import { useSession } from 'next-auth/react';
import { withAuthRetry } from '@/utils/apiHelpers';

export default function RefreshButton({ onSuccess, onError, className = '' }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState(null);
  const { update: updateSession } = useSession();
  
  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    setMessage('Refreshing authentication...');
    
    try {
      // Use the withAuthRetry function for reliable token refresh
      await withAuthRetry(async () => {
        const response = await fetch('/api/refresh-session');
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to refresh session');
        }
        
        // Update the session with new tokens
        await updateSession();
        return true;
      }, {
        maxRetries: 3, // Limit retries since this is a user-initiated action
        initialDelay: 2000,
        maxDelay: 10000,
        onRetry: ({ retryCount }) => {
          setMessage(`Retry attempt ${retryCount}...`);
        }
      });
      
      // Success
      setMessage('Session refreshed!');
      if (onSuccess) onSuccess();
      
      // Clear success message after a delay
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Session refresh failed:', error);
      setMessage(`Refresh failed: ${error.message}`);
      if (onError) onError(error);
      
      // Clear error message after a delay
      setTimeout(() => {
        setMessage(null);
      }, 5000);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  return (
    <div className="relative">
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={`px-3 py-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        title="Refresh authentication tokens"
      >
        <FaSync className={isRefreshing ? 'animate-spin' : ''} />
        <span>Refresh Auth</span>
      </button>
      
      {message && (
        <div className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 shadow-lg rounded-md p-2 text-xs w-48 z-10">
          {message}
        </div>
      )}
    </div>
  );
} 