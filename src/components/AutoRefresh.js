'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { FaSync } from 'react-icons/fa';

export default function AutoRefresh({ onSuccess, onError }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const { update: updateSession } = useSession();

  useEffect(() => {
    const refreshToken = async () => {
      try {
        setIsRefreshing(true);
        setError(null);
        console.log('AutoRefresh: Starting token refresh');
        
        // Call the refresh-session API endpoint
        const response = await fetch('/api/refresh-session');
        const data = await response.json();
        
        if (data.success) {
          console.log('AutoRefresh: Token refresh successful, updating session');
          
          // Update the session through next-auth
          const sessionResult = await updateSession();
          console.log('AutoRefresh: Session updated:', sessionResult ? 'Success' : 'Failed');
          
          if (onSuccess) onSuccess();
        } else {
          console.error('AutoRefresh: Failed to refresh token:', data.message);
          setError(`Failed to refresh session: ${data.message}. Please sign out and sign in again.`);
          if (onError) onError();
        }
      } catch (err) {
        console.error('AutoRefresh: Error refreshing token:', err);
        setError('An error occurred while refreshing your session. Please try signing out and signing back in.');
        if (onError) onError();
      } finally {
        setIsRefreshing(false);
      }
    };
    
    // Start refreshing immediately when component mounts
    refreshToken();
  }, [updateSession, onSuccess, onError]);
  
  const handleManualSignOut = () => {
    console.log('AutoRefresh: User initiated sign out');
    if (onError) onError();
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
        {!error ? (
          <div className="flex flex-col items-center">
            <FaSync className="text-blue-500 text-3xl animate-spin mb-4" />
            <h3 className="text-lg font-medium dark:text-white mb-2">Refreshing your session</h3>
            <p className="text-gray-600 dark:text-gray-300 text-center">
              Please wait while we refresh your authentication...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="text-red-500 text-3xl mb-4">❌</div>
            <h3 className="text-lg font-medium dark:text-white mb-2">Authentication Error</h3>
            <p className="text-gray-600 dark:text-gray-300 text-center mb-4">
              {error}
            </p>
            <button
              onClick={handleManualSignOut}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 