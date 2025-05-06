'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';

// Create context
const DriveContext = createContext(null);

// Provider component
export function DriveProvider({ children }) {
  const { data: session, status, update: updateSession } = useSession();
  const [driveFiles, setDriveFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Function to refresh session tokens
  const refreshSessionTokens = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/refresh-session');
      const data = await response.json();

      if (data.success) {
        // Update session through next-auth
        await updateSession();
        return true;
      } else if (data.action === 'sign_out') {
        // Token refresh failed completely, sign out user
        await signOut({ redirect: true, callbackUrl: '/' });
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [updateSession]);

  // Fetch video files from Google Drive
  const fetchDriveFiles = useCallback(async (retryAfterRefresh = true) => {
    if (status !== 'authenticated') {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/drive');
      const data = await response.json();
      
      if (response.ok) {
        setDriveFiles(data.files || []);
      } else if (response.status === 401 && retryAfterRefresh) {
        // Auth error, try to refresh the token and retry
        const refreshed = await refreshSessionTokens();
        if (refreshed) {
          // Retry the fetch with the new token but don't retry again to avoid loops
          return fetchDriveFiles(false);
        } else {
          setError('Authentication error. Please sign in again.');
        }
      } else {
        setError(`Failed to fetch Drive files: ${data.error}`);
      }
    } catch (error) {
      console.error('Error fetching Drive files:', error);
      setError(`Error fetching Drive files: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [status, refreshSessionTokens]);

  // Select a file
  const selectFile = (file) => {
    setSelectedFile(file);
    return file;
  };

  // Clear selected file
  const clearSelectedFile = () => {
    setSelectedFile(null);
  };

  // Handle session refresh when auth errors occur
  const handleAuthError = useCallback(async () => {
    const refreshed = await refreshSessionTokens();
    if (refreshed) {
      setError(null);
      return true;
    }
    return false;
  }, [refreshSessionTokens]);

  // Effect for initial data load when session changes
  useEffect(() => {
    if (status === 'authenticated') {
      fetchDriveFiles();
    }
  }, [status, fetchDriveFiles]);

  const value = {
    driveFiles,
    selectedFile,
    loading,
    error,
    isRefreshing,
    fetchDriveFiles,
    selectFile,
    clearSelectedFile,
    handleAuthError,
  };

  return <DriveContext.Provider value={value}>{children}</DriveContext.Provider>;
}

// Custom hook for using the context
export function useDrive() {
  const context = useContext(DriveContext);
  if (context === null) {
    throw new Error('useDrive must be used within a DriveProvider');
  }
  return context;
} 