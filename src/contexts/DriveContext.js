'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { fetchDriveFoldersWithCache } from '@/utils/driveHelpers';
import { useSession } from 'next-auth/react';

// Create context
const DriveContext = createContext(null);

// Provider component
export function DriveProvider({ children }) {
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveFolders, setDriveFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const { data: session } = useSession();

  // Real implementation for fetchDriveFiles
  const fetchDriveFiles = useCallback(async (forceRefresh = false) => {
    if (!session) {
      console.warn('No session available, cannot fetch drive files');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/drive/list-files', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch files: ${errorData}`);
      }

      const data = await response.json();
      setDriveFiles(data.files || []);
      setLastChecked(new Date());
      return data.files || [];
    } catch (error) {
      console.error('Error fetching drive files:', error);
      setError(getUserFriendlyErrorMessage(error));
      return [];
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Real implementation for fetchDriveFolders using the shared utility
  const fetchDriveFolders = useCallback(async (forceRefresh = false) => {
    if (!session) {
      console.warn('No session available, cannot fetch drive folders');
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Use the shared utility function
      const result = await fetchDriveFoldersWithCache({
        forceRefresh: forceRefresh,
        setLoadingState: setFoldersLoading,
        setFoldersState: setDriveFolders,
        onFolderCheck: (folders) => {
          // Check if the currently selected folder still exists
          if (selectedFolder) {
            const folderStillExists = folders.some(folder => folder.id === selectedFolder.id);
            if (!folderStillExists) {
              console.log(`Selected folder ${selectedFolder.id} no longer exists, resetting selection`);
              setSelectedFolder(null);
            }
          }
        }
      });

      if (!result.success) {
        console.error('Error fetching drive folders:', result.error);
        setError(getUserFriendlyErrorMessage(result.error));
      }

      return result;
    } catch (error) {
      console.error('Error in fetchDriveFolders:', error);
      setError(getUserFriendlyErrorMessage(error));
      return { success: false, error: error.message };
    }
  }, [session, selectedFolder]);

  // Function to select a file
  const selectFile = (file) => {
    setSelectedFile(file);
  };

  // Function to clear selected file
  const clearSelectedFile = () => {
    setSelectedFile(null);
  };

  // Function to select a folder
  const selectFolder = (folder) => {
    setSelectedFolder(folder);
  };

  // Function to clear selected folder
  const clearSelectedFolder = () => {
    setSelectedFolder(null);
  };

  // Get user-friendly error message
  const getUserFriendlyErrorMessage = (error) => {
    if (!error) return 'Unknown error occurred';
    
    // Handle string error messages
    if (typeof error === 'string') {
      return error;
    }

    // Handle error objects
    return error.message || 'Unknown error occurred';
  };

  const value = {
    driveFiles,
    driveFolders,
    loading,
    foldersLoading,
    error,
    lastChecked,
    selectedFile,
    selectedFolder,
    fetchDriveFiles,
    fetchDriveFolders,
    selectFile,
    clearSelectedFile,
    selectFolder,
    clearSelectedFolder,
    getUserFriendlyErrorMessage
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