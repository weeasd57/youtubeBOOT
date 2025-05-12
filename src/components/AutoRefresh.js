'use client';

import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { isAuthError } from '@/utils/apiHelpers';
import { FaSync } from 'react-icons/fa';

export default function AutoRefresh({ onSuccess, onError }) {
  const { update: updateSession } = useSession();
  const [refreshState, setRefreshState] = useState({
    isAttempting: false,
    errorCount: 0,
    nextAttempt: null,
    message: 'Preparing to refresh authentication...'
  });
  
  // Use a simple retry approach instead of persistent retry
  useEffect(() => {
    let mounted = true;
    let timeoutId = null;
    
    const attemptRefresh = async () => {
      if (!mounted) return;
      
      setRefreshState(prev => ({
        ...prev,
        isAttempting: true,
        message: 'Refreshing authentication token...'
      }));
      
      try {
        // Call the refresh session endpoint
        const response = await fetch('/api/refresh-session');
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to refresh session');
        }
        
        // Update the session with the new tokens
        await updateSession();
        
        if (mounted) {
          setRefreshState({
            isAttempting: false,
            errorCount: 0,
            nextAttempt: null,
            message: 'Session refreshed successfully!'
          });
          
          if (onSuccess) onSuccess();
        }
      } catch (error) {
        console.error(`Failed to refresh session:`, error);
        
        if (!mounted) return;
        
        // Increment error count
        const newErrorCount = refreshState.errorCount + 1;
        
        setRefreshState(prev => ({
          ...prev,
          isAttempting: false,
          errorCount: newErrorCount,
          message: `Failed to refresh: ${error.message || 'Unknown error'}`
        }));
        
        // If maximum retry attempts reached or critical error, trigger sign out
        if (newErrorCount >= 3 || 
            (error.message && error.message.includes('revoked')) || 
            (error.message && error.message.includes('sign in again'))) {
          console.error('Critical refresh error or max retries reached - signing out:', error);
          if (onError) onError(error);
          
          // Sign out after 3 seconds to allow reading the error message
          setTimeout(() => {
            signOut({ callbackUrl: '/' });
          }, 3000);
          
          return;
        }
        
        // Schedule next retry with increasing delay
        const delay = Math.min(5000 * Math.pow(2, newErrorCount - 1), 30000);
        
        setRefreshState(prev => ({
          ...prev,
          nextAttempt: new Date(Date.now() + delay),
          message: `Retry #${newErrorCount + 1} scheduled in ${Math.round(delay/1000)}s...`
        }));
        
        // Schedule next retry
        timeoutId = setTimeout(attemptRefresh, delay);
      }
    };
    
    // Start the first attempt
    attemptRefresh();
    
    // Cleanup function
    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [updateSession, onSuccess, onError, refreshState.errorCount]);
  
  const handleManualSignOut = () => {
    console.log('AutoRefresh: User initiated sign out');
    signOut({ callbackUrl: '/' });
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