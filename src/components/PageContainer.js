'use client';

import { useState, useEffect } from 'react';
import { FaSync } from 'react-icons/fa';
import { signOut, useSession } from 'next-auth/react';
import Image from "next/image";
import ThemeToggle from './ThemeToggle';
import ClientOnly from './ClientOnly';
import AuthErrorBanner from './AuthErrorBanner';
import { toastHelper } from './ToastHelper';

export default function PageContainer({ user, children, onRefresh = null, error = null }) {
  const [refreshing, setRefreshing] = useState(false);
  const [showAuthError, setShowAuthError] = useState(false);
  const [validationInProgress, setValidationInProgress] = useState(false);
  const { update: updateSession } = useSession();

  // Check if the error is authentication related and if tokens are actually working
  useEffect(() => {
    if (!error) {
      setShowAuthError(false);
      return;
    }

    // Only validate for authentication errors
    const errorMessage = typeof error === 'string' ? error : error.message || '';
    const isAuthError = errorMessage.includes('Authentication') || 
                         errorMessage.includes('auth') ||
                         errorMessage.includes('token') ||
                         errorMessage.includes('Invalid Credentials');
    
    if (!isAuthError) {
      setShowAuthError(false);
      return;
    }
    
    // Validate if tokens are actually working despite the error
    const validateTokens = async () => {
      if (validationInProgress) return;
      
      setValidationInProgress(true);
      try {
        // Check token status with the debug endpoint
        const response = await fetch('/api/auth/debug');
        const data = await response.json();
        
        // If we have valid tokens, don't show the error
        if (response.ok && data.status === 'authenticated' && 
            data.tokenInfo && data.tokenInfo.isValid) {
          setShowAuthError(false);
          console.log("Tokens are valid, hiding authentication error");
        } else {
          setShowAuthError(true);
        }
      } catch (e) {
        console.error("Error validating tokens:", e);
        setShowAuthError(true);
      } finally {
        setValidationInProgress(false);
      }
    };
    
    validateTokens();
  }, [error, validationInProgress]);

  // Function to refresh auth
  const handleRefreshAuth = async () => {
    setRefreshing(true);
    
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Success message with toast instead of alert
        toastHelper.success('Authentication refreshed successfully!');
        // If we have an onRefresh callback, call it
        if (onRefresh) onRefresh();
      } else {
        // Handle different error types with appropriate toasts
        if (data.needsReauth) {
          toastHelper.error('Your access to Google services has been revoked. Please sign out and sign in again to reconnect your account.');
        } else if (data.isNetworkError) {
          toastHelper.warning('Network error occurred. Please check your connection and try again.');
        } else if (data.retryAttempts) {
          toastHelper.warning(`Authentication refresh failed after ${data.retryAttempts} attempts. Please try again later.`);
        } else {
          toastHelper.error(`Error refreshing authentication: ${data.message || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error refreshing auth:', error);
      toastHelper.error('Failed to refresh authentication. Please try again or sign out and sign in again.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-black text-black dark:text-amber-50 transition-colors duration-300">
      {/* Content with padding to account for sticky navbar */}
      <div className="mt-4 pb-16">
        {/* Show auth error banner conditionally */}
        {showAuthError && error && (
          <div className="mx-4 mb-4">
            <AuthErrorBanner 
              message={typeof error === 'object' ? error.message : error} 
              isNetworkError={typeof error === 'object' && error.isNetworkError}
              failureCount={typeof error === 'object' && error.failureCount}
              maxFailures={typeof error === 'object' && error.maxFailures}
              forceSignOut={typeof error === 'object' && error.forceSignOut}
              isAccessRevoked={typeof error === 'object' && error.isAccessRevoked}
            />
          </div>
        )}
        
        {children}
      </div>
    </div>
  );
} 