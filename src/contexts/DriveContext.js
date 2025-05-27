'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { fetchDriveFoldersWithCache } from '@/utils/driveHelpers';
import { useSession } from 'next-auth/react';
import { useAccounts } from '@/contexts/AccountContext';

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
  const { activeAccount } = useAccounts(); // Consume activeAccount from AccountContext

  // Real implementation for fetchDriveFiles
  const fetchDriveFiles = useCallback(async () => {
    try {
      // Check for activeAccount instead of session properties
      if (!activeAccount || !activeAccount.id) {
        console.warn("fetchDriveFiles: No active account available.");
        setDriveFiles([]); // Clear files if no active account
        setError("Please ensure you're logged in and have an active account selected.");
        return;
      }

      setLoading(true);
      setError(null);

      // Direct API call using fetch instead of relying on driveService
      try {
        const response = await fetch('/api/drive-files');
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Authentication required. Please sign in again.");
          }
          throw new Error(`Failed to fetch drive files: ${response.statusText}`);
        }
        
        const data = await response.json();
        setDriveFiles(data.files || []);
        setLastChecked(new Date());
      } catch (apiError) {
        console.error("API Error fetching files:", apiError);
        setError(getUserFriendlyErrorMessage(apiError));
        setDriveFiles([]);
      }
    } catch (error) {
      console.error("Error in fetchDriveFiles:", error);
      setError(getUserFriendlyErrorMessage(error));
      setDriveFiles([]);
    } finally {
      setLoading(false);
    }
  }, [activeAccount]); // Depend on activeAccount

  // Fetch files when activeAccount changes
  useEffect(() => {
    if (activeAccount) {
      fetchDriveFiles();
    } else {
      // Clear files if active account is unset
      setDriveFiles([]);
    }
  }, [activeAccount, fetchDriveFiles]);


  // Real implementation for fetchDriveFolders using direct API call
  const fetchDriveFolders = useCallback(async (forceRefresh = false) => {
    // Check for active account
    if (!activeAccount) {
      console.warn('No active account available, cannot fetch drive folders');
      return { success: false, error: 'Not authenticated' };
    }

    try {
      setFoldersLoading(true);
      setError(null);

      // Direct API call instead of utility function
      const response = await fetch('/api/drive-folders');
      
      if (!response.ok) {
        if (response.status === 401) {
          setError("Authentication required. Please sign in again.");
          return { success: false, error: 'Authentication required' };
        }
        throw new Error(`Failed to fetch folders: ${response.statusText}`);
      }
      
      const data = await response.json();
      const folders = data.folders || [];
      
      // Check if the currently selected folder still exists
      if (selectedFolder) {
        const folderStillExists = folders.some(folder => folder.id === selectedFolder.id);
        if (!folderStillExists) {
          console.log(`Selected folder ${selectedFolder.id} no longer exists, resetting selection`);
          setSelectedFolder(null);
        }
      }
      
      setDriveFolders(folders);
      return { success: true, folders };

    } catch (error) {
      console.error('Error in fetchDriveFolders:', error);
      setError(getUserFriendlyErrorMessage(error));
      return { success: false, error: error.message };
    } finally {
      setFoldersLoading(false);
    }
  }, [activeAccount, selectedFolder]); // Depend on activeAccount and selectedFolder

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