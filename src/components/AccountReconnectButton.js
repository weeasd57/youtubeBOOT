'use client';

import { useState } from 'react';
import { FaSync, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'react-hot-toast';

/**
 * Component for handling account reconnection
 * Shows when an account needs reauthentication
 */
export default function AccountReconnectButton({ 
  accountId, 
  accountName, 
  onReconnectStart,
  onReconnectComplete,
  className = ""
}) {
  const [isReconnecting, setIsReconnecting] = useState(false);

  const handleReconnect = async () => {
    if (isReconnecting) return;

    setIsReconnecting(true);
    
    try {
      // Notify parent component that reconnection started
      if (onReconnectStart) {
        onReconnectStart(accountId);
      }

      // Call the reconnect API to get the OAuth URL
      const response = await fetch('/api/accounts/reconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to initiate reconnection');
      }

      if (data.success && data.authUrl) {
        // Show loading toast
        const toastId = toast.loading('Opening Google authentication window...');
        
        // Open the OAuth URL in a new window
        const authWindow = window.open(
          data.authUrl,
          'reconnect-account',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        // Monitor the auth window
        const checkClosed = setInterval(() => {
          if (authWindow.closed) {
            clearInterval(checkClosed);
            toast.dismiss(toastId);
            
            // Wait a bit for the callback to process, then refresh
            setTimeout(() => {
              toast.success('Account reconnected successfully!');
              
              // Notify parent component
              if (onReconnectComplete) {
                onReconnectComplete(accountId);
              }
              
              // Refresh the page to update the UI
              window.location.reload();
            }, 2000);
          }
        }, 1000);

        // Auto-close toast after 30 seconds if window is still open
        setTimeout(() => {
          if (!authWindow.closed) {
            toast.dismiss(toastId);
            toast('Please complete the authentication in the popup window', {
              icon: '⏳',
              duration: 5000
            });
          }
        }, 30000);

      } else {
        throw new Error('Failed to get authentication URL');
      }

    } catch (error) {
      console.error('Error during reconnection:', error);
      toast.error(`Reconnection failed: ${error.message}`);
    } finally {
      setIsReconnecting(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <FaExclamationTriangle className="text-sm" />
        <span className="text-sm font-medium">
          {accountName ? `${accountName} needs reconnection` : 'Account needs reconnection'}
        </span>
      </div>
      
      <button
        onClick={handleReconnect}
        disabled={isReconnecting}
        className={`
          px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200
          ${isReconnecting 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : 'bg-red-100 hover:bg-red-200 text-red-700 hover:text-red-800 border border-red-200 hover:border-red-300'
          }
          dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 dark:hover:text-red-300 
          dark:border-red-800/30 dark:hover:border-red-700/40
          flex items-center gap-2
        `}
      >
        <FaSync className={`text-xs ${isReconnecting ? 'animate-spin' : ''}`} />
        {isReconnecting ? 'Reconnecting...' : 'Reconnect Account'}
      </button>
    </div>
  );
}