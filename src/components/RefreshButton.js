'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { FaSync } from 'react-icons/fa';

export default function RefreshButton({ onSuccess, onError, className = '' }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { update: updateSession } = useSession();

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      console.log('RefreshButton: Starting token refresh');
      
      // Call the refresh-session API endpoint
      const response = await fetch('/api/refresh-session');
      const data = await response.json();
      
      if (data.success) {
        console.log('RefreshButton: Token refresh successful, updating session');
        
        // Update the session through next-auth
        const sessionResult = await updateSession();
        console.log('RefreshButton: Session updated:', sessionResult ? 'Success' : 'Failed');
        
        // Force a call to get new token into the session
        console.log('RefreshButton: Forcing another session update to ensure token is propagated');
        await updateSession();
        
        if (onSuccess) onSuccess();
        
        // Optional: Force a page reload to ensure all components get fresh tokens
        // This is a more aggressive approach but ensures tokens are fully refreshed
        // window.location.reload();
      } else {
        console.error('RefreshButton: Failed to refresh token:', data.message);
        if (onError) onError();
      }
    } catch (err) {
      console.error('RefreshButton: Error refreshing token:', err);
      if (onError) onError();
    } finally {
      setIsRefreshing(false);
    }
  };
  
  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 ${className}`}
    >
      <FaSync className={isRefreshing ? 'animate-spin' : ''} />
      <span>{isRefreshing ? 'Refreshing...' : 'Refresh Token'}</span>
    </button>
  );
} 