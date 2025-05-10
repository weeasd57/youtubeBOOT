'use client';

import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { createPersistentRetry, isAuthError } from '@/utils/apiHelpers';
import { FaSync } from 'react-icons/fa';

export default function AutoRefresh({ onSuccess, onError }) {
  const { update: updateSession } = useSession();
  const [refreshState, setRefreshState] = useState({
    isAttempting: false,
    errorCount: 0,
    nextAttempt: null,
    message: 'Preparing to refresh authentication...'
  });
  
  useEffect(() => {
    // Create a persistent retry controller
    const retryController = createPersistentRetry(
      async () => {
        setRefreshState(prev => ({
          ...prev,
          isAttempting: true,
          message: 'Refreshing authentication token...'
        }));
        
        // Call the refresh session endpoint
        const response = await fetch('/api/refresh-session');
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to refresh session');
        }
        
        // Update the session with the new tokens
        await updateSession();
        
        return true; // Success
      },
      {
        initialDelay: 3000,
        maxDelay: 20000,
        onSuccess: () => {
          console.log('Session refreshed successfully!');
          setRefreshState({
            isAttempting: false,
            errorCount: 0,
            nextAttempt: null,
            message: 'Session refreshed successfully!'
          });
          
          if (onSuccess) onSuccess();
        },
        onError: (error, retryCount) => {
          console.error(`Failed to refresh session (attempt ${retryCount}):`, error);
          
          setRefreshState(prev => ({
            ...prev,
            errorCount: retryCount,
            message: `Failed to refresh: ${error.message || 'Unknown error'}`
          }));
          
          // If maximum retry attempts and errors are severe, sign out
          if (retryCount >= 5 && !isAuthError(error)) {
            console.error('Critical refresh error - signing out:', error);
            if (onError) onError(error);
            
            // Sign out on critical errors after multiple retries
            setTimeout(() => {
              signOut({ callbackUrl: '/' });
            }, 2000);
            
            return;
          }
        },
        onRetry: ({ retryCount, delay, nextAttemptTime }) => {
          setRefreshState(prev => ({
            ...prev,
            isAttempting: false,
            nextAttempt: nextAttemptTime,
            message: `Retry #${retryCount} scheduled in ${Math.round(delay/1000)}s...`
          }));
        },
        // Longer delays for auth errors, shorter for network/temporary issues
        getDelayMultiplier: (error) => {
          if (error.message?.includes('network') || error.message?.includes('timeout')) {
            return 0.5; // Shorter delay for network issues
          }
          return 1;
        }
      }
    );
    
    // Start the retry process
    retryController.start();
    
    // Clean up when component unmounts
    return () => {
      retryController.stop();
    };
  }, [updateSession, onSuccess, onError]);
  
  const handleManualSignOut = () => {
    console.log('AutoRefresh: User initiated sign out');
    if (onError) onError();
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
        {!refreshState.errorCount ? (
          <div className="flex flex-col items-center">
            <FaSync className="text-blue-500 text-3xl animate-spin mb-4" />
            <h3 className="text-lg font-medium dark:text-white mb-2">Refreshing your session</h3>
            <p className="text-gray-600 dark:text-gray-300 text-center">
              {refreshState.message}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="text-red-500 text-3xl mb-4">❌</div>
            <h3 className="text-lg font-medium dark:text-white mb-2">Authentication Error</h3>
            <p className="text-gray-600 dark:text-gray-300 text-center mb-4">
              {refreshState.message}
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