'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { fetchDriveFoldersWithCache } from '@/utils/driveHelpers';
import { useSession } from 'next-auth/react';
import { useAccounts } from '@/contexts/AccountContext';
import { supabase } from '@/utils/supabase';

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

  // Fetch drive folders
  const fetchDriveFolders = useCallback(async (forceRefresh = false) => {
    // Early check for active account
    if (!activeAccount) {
      console.log('No active account, skipping Drive folders fetch');
      // Clear folders to avoid showing stale data
      setDriveFolders([]);
      setFoldersLoading(false);
      setError('No active account available, please connect an account first');
      return { success: false, error: 'No active account' };
    }
    
    // Check if account has necessary properties
    if (!activeAccount.id) {
      console.log('Invalid active account (missing ID), skipping Drive folders fetch');
      setDriveFolders([]);
      setFoldersLoading(false);
      setError('Invalid account information. Please reconnect your account.');
      return { success: false, error: 'Invalid account' };
    }
    
    setFoldersLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching Drive folders for account ${activeAccount.id}${forceRefresh ? ' (force refresh)' : ''}`);
      
      const result = await fetchDriveFoldersWithCache({
        forceRefresh,
        accountId: activeAccount.id, // Make sure accountId is passed
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
        console.warn('Failed to fetch folders:', result.error);
        setError(getUserFriendlyErrorMessage(result.error));
      } else {
        console.log(`Retrieved ${result.folders?.length || 0} folders from ${result.fromCache ? 'cache' : 'API'}`);
        // Clear error if successful
        setError(null);
      }
      
      // If we got empty folders and it wasn't a forced refresh, try again with force refresh
      // Only if not throttled to avoid spamming the API
      if (Array.isArray(result.folders) && result.folders.length === 0 && !forceRefresh && !result.throttled) {
        console.log('Got empty folders list, trying force refresh...');
        return fetchDriveFolders(true);
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching Drive folders:', error);
      setError(getUserFriendlyErrorMessage(error));
      setFoldersLoading(false);
      return { success: false, error: error.message };
    }
  }, [activeAccount, selectedFolder]); // Depend on activeAccount and selectedFolder

  // Track previous active account to prevent unnecessary re-fetches
  const prevActiveAccount = useRef(activeAccount);

  // Fetch files when activeAccount changes
  useEffect(() => {
    // Skip if activeAccount hasn't changed
    if (activeAccount?.id === prevActiveAccount.current?.id) {
      return;
    }

    // Update the ref to current activeAccount
    prevActiveAccount.current = activeAccount;

    if (activeAccount) {
      console.log('Active account changed, fetching Drive data for account:', activeAccount.id);
      
      // Clear previous data
      setDriveFiles([]);
      setDriveFolders([]);
      setError(null);
      
      // Fetch fresh data
      const fetchData = async () => {
        try {
          // Try to verify the account in Supabase (optional check)
          let accountValid = true;
          try {
            const { data: accountData, error: accountError } = await supabase
              .from('accounts')
              .select('id, is_active, last_used_at')
              .eq('id', activeAccount.id)
              .single();
              
            if (accountError) {
              console.warn('Could not verify account in Supabase (continuing anyway):', accountError);
              // Don't fail completely, just log the warning
            } else if (accountData && !accountData.is_active) {
              setError('This account is no longer active. Please select another account.');
              accountValid = false;
            }
          } catch (supabaseError) {
            console.warn('Supabase verification failed (continuing anyway):', supabaseError);
            // Continue without Supabase verification
          }
          
          // If account seems valid or we can't verify, proceed with fetching drive data
          if (accountValid) {
            await Promise.all([
              fetchDriveFiles(),
              fetchDriveFolders()
            ]);
          }
          
        } catch (error) {
          console.error('Error initializing Drive data:', error);
          setError('Failed to initialize Drive data. Please try again.');
        }
      };
      
      fetchData();
      
      // Set up periodic folder refresh (every 30 minutes)
      const refreshInterval = 60 * 60 * 1000; // Change to 60 minutes
      const periodicRefreshTimer = setInterval(() => {
        console.log('Periodic Drive folders refresh');
        fetchDriveFolders(false); // Non-forced refresh periodically
      }, refreshInterval);
      
      return () => {
        clearInterval(periodicRefreshTimer);
      };
    } else {
      // Clear files if active account is unset
      setDriveFiles([]);
      setDriveFolders([]);
      setError('No active account selected');
    }
  }, [activeAccount, fetchDriveFiles, fetchDriveFolders]);
  
  // Periodically check if selected folder still exists - similar to TikTokContext
  useEffect(() => {
    if (!activeAccount || !selectedFolder) return;
    
    // Add a timestamp check to avoid excessive API calls
    const lastFolderCheck = localStorage.getItem('lastDriveFolderCheck');
    const currentTime = Date.now();
    
    // Only fetch folders if we haven't checked in the last 30 minutes
    const shouldFetch = !lastFolderCheck || (currentTime - parseInt(lastFolderCheck)) > 30 * 60 * 1000;
    
    if (shouldFetch) {
      // Set timestamp before fetching to avoid race conditions
      localStorage.setItem('lastDriveFolderCheck', currentTime.toString());
      fetchDriveFolders();
    }
    
    // Check every 30 minutes if the folder still exists
    const intervalId = setInterval(() => {
      if (selectedFolder) {
        localStorage.setItem('lastDriveFolderCheck', Date.now().toString());
        fetchDriveFolders();
      }
    }, 30 * 60 * 1000); // 30 minutes
    
    return () => clearInterval(intervalId);
  }, [activeAccount?.id, selectedFolder?.id]); // Use stable IDs instead of function references

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
  console.log('useDrive hook called, context:', context);
  
  if (context === null) {
    console.error('useDrive must be used within a DriveProvider');
    // Instead of throwing, return a mock context to prevent crashes
    return {
      driveFiles: [],
      driveFolders: [],
      loading: false,
      foldersLoading: false,
      error: 'Drive context not available',
      lastChecked: null,
      selectedFile: null,
      selectedFolder: null,
      fetchDriveFiles: async () => { console.warn('fetchDriveFiles called but DriveProvider is not available'); },
      fetchDriveFolders: async () => { console.warn('fetchDriveFolders called but DriveProvider is not available'); },
      selectFile: () => {},
      clearSelectedFile: () => {},
      selectFolder: () => {},
      clearSelectedFolder: () => {},
      getUserFriendlyErrorMessage: (error) => error?.message || 'Drive context not available'
    };
  }
  
  return context;
}