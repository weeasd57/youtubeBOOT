import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useUser } from './UserContext';
import { useSession } from 'next-auth/react';
import { useAccounts } from './AccountContext.tsx';
import { fetchDriveFoldersWithCache, fetchDriveFilesWithCache } from '@/utils/driveHelpers';
import { Account } from '@/types/account';

// Optimized timing constants
const DEBOUNCE_DELAY = 150; // Reduced from 300ms
const THROTTLE_DELAY = 2000; // Reduced from 5000ms
const GLOBAL_REFRESH_DELAY = 30000; // Reduced from 60000ms
const BATCH_SIZE = 3; // Number of concurrent requests
const STAGGER_DELAY = 500; // Delay between batches

const debounce = (fn: (...args: any[]) => void, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

interface DriveInfo {
  folders: any[];
  files: any[];
  status: string;
  lastUpdated: string;
}

interface MultiDriveContextType {
  drivesInfo: { [accountId: string]: DriveInfo };
  loadingDrives: { [accountId: string]: boolean };
  errors: { [accountId: string]: string | null };
  refreshDriveInfo: (accountId: string, forceRefresh?: boolean) => Promise<any>;
  refreshDriveFiles: (accountId: string, forceRefresh?: boolean) => Promise<any>;
  driveFiles: any[];
  driveFolders: any[];
  loading: boolean;
  error: string | null;
  selectedFolder: any | null;
  selectFolder: (folder: any) => void;
  clearSelectedFolder: () => void;
}

const MultiDriveContext = createContext<MultiDriveContextType | null>(null);

export function MultiDriveProvider({ children }: { children: React.ReactNode }) {
  const [drivesInfo, setDrivesInfo] = useState<{ [accountId: string]: DriveInfo }>({});
  const [loadingDrives, setLoadingDrives] = useState<{ [accountId: string]: boolean }>({});
  const [errors, setErrors] = useState<{ [accountId: string]: string | null }>({});
  
  // Get accounts from AccountContext - activeAccount is no longer used
  const { accounts, loading: accountsLoading } = useAccounts();
  const { data: session } = useSession();
  
  const accountsRef = useRef<Account[] | null>(null);
  const pendingFetches = useRef<Map<string, Promise<any>>>(new Map());
  const lastFetchTimes = useRef<Map<string, number>>(new Map());
  const mounted = useRef(true);
  const loadingDrivesRef = useRef<{ [accountId: string]: boolean }>({});
  const [selectedFolder, setSelectedFolder] = useState<any | null>(null);

  // Component lifecycle management
  useEffect(() => {
    accountsRef.current = accounts;
    return () => {
      mounted.current = false;
      pendingFetches.current.clear();
      lastFetchTimes.current.clear();
    };
  }, [accounts]);

  // Update loadingDrivesRef whenever loadingDrives state changes
  useEffect(() => {
    loadingDrivesRef.current = loadingDrives;
  }, [loadingDrives]);

  // Token refresh handling - needs re-evaluation as activeAccount is removed
  // For now, simplifying it to remove dependency on activeAccount
  const handleAuthError = useCallback(async (accountId: string) => {
    try {
      console.log(`[MultiDriveContext] handleAuthError triggered for account: ${accountId}`);
      const response = await fetch('/api/auth/session');
      if (!response.ok) {
        console.warn('[MultiDriveContext] Session fetch failed during auth error handling.');
        return false;
      }

      const sessionData = await response.json();
      if (!sessionData?.user) {
        console.warn('[MultiDriveContext] No user session during auth error handling.');
        return false;
      }

      if (!accountId) {
        console.warn('[MultiDriveContext] No accountId provided for auth error handling.');
        return false;
      }

      console.log(`[MultiDriveContext] Attempting to refresh token for account: ${accountId}`);
      const tokenResponse = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        console.error(`[MultiDriveContext] Token refresh failed for ${accountId}: ${tokenResponse.status} - ${errorBody}`);
      }

      return tokenResponse.ok;
    } catch (error: any) {
      console.error('[MultiDriveContext] Error in handleAuthError:', error);
      return false;
    }
  }, []); // Dependency on activeAccount removed

  // Data comparison utility
  const hasDataChanged = useCallback((oldData: any[], newData: any[], keys = ['id', 'name']) => {
    if (!oldData || !newData) return true;
    if (oldData.length !== newData.length) return true;
    return newData.some((newItem, index) => {
      const oldItem = oldData[index];
      return !oldItem || keys.some(key => oldItem[key] !== newItem[key]);
    });
  }, []);

  // Drive info fetching with optimizations
  const fetchDriveInfo = useCallback(async (accountId: string, forceRefresh = false) => {
    if (!accountId || !mounted.current) {
      console.log(`[MultiDriveContext] fetchDriveInfo: No accountId or component unmounted. AccountId: ${accountId}`);
      return;
    }
    if (loadingDrivesRef.current[accountId] && !forceRefresh) {
      console.log(`[MultiDriveContext] fetchDriveInfo: Already loading for ${accountId} and not forced.`);
      return;
    }

    const now = Date.now();
    const lastFetch = lastFetchTimes.current.get(accountId);
    if (!forceRefresh && lastFetch && (now - lastFetch < THROTTLE_DELAY)) {
      console.log(`[MultiDriveContext] fetchDriveInfo: Throttling for ${accountId}.`);
      return;
    }

    if (pendingFetches.current.has(accountId)) {
      try {
        console.log(`[MultiDriveContext] fetchDriveInfo: Returning pending fetch for ${accountId}.`);
        return await pendingFetches.current.get(accountId);
      } catch (e) {
        console.error(`[MultiDriveContext] fetchDriveInfo: Error in pending fetch for ${accountId}:`, e);
        pendingFetches.current.delete(accountId);
      }
    }

    setLoadingDrives(prev => ({ ...prev, [accountId]: true }));
    setErrors(prev => ({ ...prev, [accountId]: null }));

    const fetchPromise = (async () => {
      try {
        console.log(`[MultiDriveContext] fetchDriveInfo: Starting fetch for ${accountId}.`);
        const result = await fetchDriveFoldersWithCache({
          forceRefresh,
          accountId,
          onFolderCheck: () => {},
          setLoadingState: (loading) => setLoadingDrives(prev => ({ ...prev, [accountId]: loading})),
          setFoldersState: (folders) => setDrivesInfo(prev => ({ 
            ...prev, 
            [accountId]: { ...prev[accountId], folders, status: 'connected', lastUpdated: new Date().toISOString() }
          })),
          onError: (errorMessage) => setErrors(prev => ({ ...prev, [accountId]: errorMessage})),
          onAuthError: () => handleAuthError(accountId) // Pass accountId to handleAuthError
        });

        if (!mounted.current) {
          console.log(`[MultiDriveContext] fetchDriveInfo: Component unmounted during fetch for ${accountId}.`);
          return;
        }

        if (result.success) {
          setDrivesInfo(prev => {
            const currentAccountData = prev[accountId] || { folders: [], files: [], status: 'loading', lastUpdated: '' };

            const oldFolders = Array.isArray(currentAccountData.folders) ? currentAccountData.folders : [];
            const newFolders = result.folders || [];

            if (!hasDataChanged(oldFolders, newFolders)) {
              console.log(`[MultiDriveContext] fetchDriveInfo: No folder data change for ${accountId}.`);
              return prev;
            }

            console.log(`[MultiDriveContext] fetchDriveInfo: Setting folders for ${accountId}.`);
            return {
              ...prev,
              [accountId]: {
                ...currentAccountData,
                folders: newFolders,
                status: 'connected',
                lastUpdated: new Date().toISOString(),
              },
            };
          });
        } else {
          if (!mounted.current) return;
          
          setDrivesInfo(prev => ({
            ...prev,
            [accountId]: {
              ...prev[accountId],
              folders: [],
              files: prev[accountId]?.files || [], // Preserve existing files
              status: 'no_data',
              lastUpdated: new Date().toISOString(),
            },
          }));

          if (result.error) {
            setErrors(prev => ({ ...prev, [accountId]: result.error }));
          }
          console.error(`[MultiDriveContext] fetchDriveInfo: Failed for ${accountId}:`, result.error);
        }

        return result;
      } catch (error: any) {
        if (!mounted.current) return;
        
        setErrors(prev => ({
          ...prev,
          [accountId]: error.message || 'An unexpected error occurred',
        }));
        console.error(`[MultiDriveContext] fetchDriveInfo: Caught error for ${accountId}:`, error);
        throw error;
      } finally {
        if (mounted.current) {
          setLoadingDrives(prev => ({ ...prev, [accountId]: false }));
        }
        pendingFetches.current.delete(accountId);
        lastFetchTimes.current.set(accountId, Date.now());
        console.log(`[MultiDriveContext] fetchDriveInfo: Finished for ${accountId}.`);
      }
    })();

    pendingFetches.current.set(accountId, fetchPromise);
    return fetchPromise;
  }, [loadingDrivesRef, hasDataChanged]);

  // File fetching with optimizations
  const fetchDriveFiles = useCallback(async (accountId: string, forceRefresh = false) => {
    if (!accountId || !mounted.current) {
      console.log(`[MultiDriveContext] fetchDriveFiles: No accountId or component unmounted. AccountId: ${accountId}`);
      return;
    }
    if (loadingDrives[accountId] && !forceRefresh) {
      console.log(`[MultiDriveContext] fetchDriveFiles: Already loading for ${accountId} and not forced.`);
      return;
    }

    const now = Date.now();
    const lastFetch = lastFetchTimes.current.get(`${accountId}_files`);
    if (!forceRefresh && lastFetch && (now - lastFetch < THROTTLE_DELAY)) {
      console.log(`[MultiDriveContext] fetchDriveFiles: Throttling for ${accountId}.`);
      return;
    }

    setLoadingDrives(prev => ({ ...prev, [accountId]: true }));
    setErrors(prev => ({ ...prev, [accountId]: null })); // Clear error when fetching

    const fetchPromise = (async () => {
      try {
        console.log(`[MultiDriveContext] fetchDriveFiles: Starting fetch for ${accountId}.`);
        const result = await fetchDriveFilesWithCache({
          forceRefresh,
          accountId,
          onFileCheck: () => {},
          folderId: selectedFolder?.id || null,
          setLoadingState: (loading) => setLoadingDrives(prev => ({ ...prev, [accountId]: loading})),
          setFilesState: (files) => setDrivesInfo(prev => ({
            ...prev,
            [accountId]: { ...prev[accountId], files, status: 'connected', lastUpdated: new Date().toISOString() }
          })),
          onError: (errorMessage) => setErrors(prev => ({ ...prev, [accountId]: errorMessage})),
          onAuthError: () => handleAuthError(accountId)
        });

        if (!mounted.current) {
          console.log(`[MultiDriveContext] fetchDriveFiles: Component unmounted during fetch for ${accountId}.`);
          return;
        }

        if (result.success) {
          setDrivesInfo(prev => {
            const currentAccountData = prev[accountId] || { folders: [], files: [], status: 'loading', lastUpdated: '' };

            const oldFiles = Array.isArray(currentAccountData.files) ? currentAccountData.files : [];
            const newFiles = result.files || [];

            if (!hasDataChanged(oldFiles, newFiles)) {
              console.log(`[MultiDriveContext] fetchDriveFiles: No file data change for ${accountId}.`);
              return prev;
            }

            console.log(`[MultiDriveContext] fetchDriveFiles: Setting files for ${accountId}.`);
            return {
              ...prev,
              [accountId]: {
                ...currentAccountData,
                files: newFiles,
                status: 'connected',
                lastUpdated: new Date().toISOString(),
              },
            };
          });
        } else {
          if (!mounted.current) return;

          setDrivesInfo(prev => ({
            ...prev,
            [accountId]: {
              ...prev[accountId],
              folders: prev[accountId]?.folders || [], // Preserve existing folders
              files: [],
              status: 'no_data',
              lastUpdated: new Date().toISOString(),
            },
          }));

          setErrors(prev => ({
            ...prev,
            [accountId]: result.error || 'Failed to fetch drive files',
          }));
          console.error(`[MultiDriveContext] fetchDriveFiles: Failed for ${accountId}:`, result.error);
        }
        return result;
      } catch (error: any) {
        if (!mounted.current) return;

        setErrors(prev => ({
          ...prev,
          [accountId]: error.message || 'An unexpected error occurred',
        }));
        console.error(`[MultiDriveContext] fetchDriveFiles: Caught error for ${accountId}:`, error);
        throw error;
      } finally {
        if (mounted.current) {
          setLoadingDrives(prev => ({ ...prev, [accountId]: false }));
        }
        pendingFetches.current.delete(`${accountId}_files`);
        lastFetchTimes.current.set(`${accountId}_files`, Date.now());
        console.log(`[MultiDriveContext] fetchDriveFiles: Finished for ${accountId}.`);
      }
    })();

    pendingFetches.current.set(`${accountId}_files`, fetchPromise);
    return fetchPromise;
  }, [loadingDrives, hasDataChanged, selectedFolder, handleAuthError]);

  // Expose a refresh function
  const refreshAllDrives = useCallback((forceRefresh = false) => {
    if (session?.user?.auth_user_id) {
      // Iterate over all accounts and refresh their drive info
      accounts.forEach(account => {
        fetchDriveInfo(account.id, forceRefresh);
        fetchDriveFiles(account.id, forceRefresh);
      });
    }
  }, [session?.user?.auth_user_id, accounts, fetchDriveInfo, fetchDriveFiles]);

  // New useEffect to fetch drive info for all accounts
  useEffect(() => {
    if (accountsLoading) {
      console.log('[MultiDriveContext] Accounts still loading, deferring drive info fetch.');
      return;
    }

    if (!session?.user?.auth_user_id) {
      console.log('[MultiDriveContext] No authenticated user, clearing drive info.');
      setDrivesInfo({});
      setLoadingDrives({});
      setErrors({});
      setSelectedFolder(null);
      return;
    }

    if (accounts.length === 0) {
      console.log('[MultiDriveContext] No accounts found, clearing drive info.');
      setDrivesInfo({});
      setLoadingDrives({});
      setErrors({});
      setSelectedFolder(null);
      return;
    }

    console.log('[MultiDriveContext] Accounts available. Initiating fetch for all drives.', accounts);

    const fetchAllDrives = async () => {
      const accountBatches: Account[][] = [];
      for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
        accountBatches.push(accounts.slice(i, i + BATCH_SIZE));
      }

      for (const batch of accountBatches) {
        await Promise.all(batch.map(async (account) => {
          try {
            await fetchDriveInfo(account.id, false);
            await fetchDriveFiles(account.id, false);
          } catch (e) {
            console.error(`[MultiDriveContext] Error fetching drive data for account ${account.id}:`, e);
          }
        }));
        if (accountBatches.indexOf(batch) < accountBatches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, STAGGER_DELAY));
        }
      }
    };

    fetchAllDrives();

  }, [accounts, accountsLoading, session?.user?.auth_user_id, fetchDriveInfo, fetchDriveFiles]);

  // Memoize the context value
  const value = useMemo<MultiDriveContextType>(() => {
    // Calculate overall loading state
    const loading = accountsLoading || Object.values(loadingDrives).some(Boolean);

    // Aggregate all errors
    const error = Object.values(errors).find(e => e !== null) || null;

    // Aggregate all files and folders from all accounts
    const allDriveFiles: any[] = [];
    const allDriveFolders: any[] = [];

    Object.values(drivesInfo).forEach(drive => {
      if (drive.files) {
        allDriveFiles.push(...drive.files);
      }
      if (drive.folders) {
        allDriveFolders.push(...drive.folders);
      }
    });

    const filteredDriveFiles = selectedFolder 
      ? allDriveFiles.filter(file => file.parents && file.parents.includes(selectedFolder.id))
      : allDriveFiles;

    // Note: Filtering folders by selectedFolder needs careful consideration if folders can have parents too.
    // For now, if a folder is selected, we only show files within it.
    // If the intent is to show sub-folders of a selected folder, more logic is needed.

    return {
      drivesInfo,
      loadingDrives,
      errors,
      refreshDriveInfo: (accountId, forceRefresh) => fetchDriveInfo(accountId, forceRefresh),
      refreshDriveFiles: (accountId, forceRefresh) => fetchDriveFiles(accountId, forceRefresh),
      driveFiles: filteredDriveFiles,
      driveFolders: allDriveFolders, // All folders are provided, filtering by selectedFolder for files only
      loading,
      error,
      selectedFolder,
      selectFolder: (folder) => setSelectedFolder(folder),
      clearSelectedFolder: () => setSelectedFolder(null),
    };
  }, [drivesInfo, loadingDrives, errors, accountsLoading, selectedFolder, fetchDriveInfo, fetchDriveFiles]);

  return (
    <MultiDriveContext.Provider value={value}>
      {children}
    </MultiDriveContext.Provider>
  );
}

// Custom hook for using the context
export function useMultiDrive() {
  const context = useContext(MultiDriveContext);
  if (context === null) {
    throw new Error('useMultiDrive must be used within a MultiDriveProvider');
  }
  return context;
}

// Custom hook for accessing a single drive's info directly
// This can be useful for components that only care about one specific account's drive
export function useSingleDrive(accountId: string) {
  const context = useContext(MultiDriveContext);
  if (context === null) {
    throw new Error('useSingleDrive must be used within a MultiDriveProvider');
  }
  const { drivesInfo, loadingDrives, errors, refreshDriveInfo, refreshDriveFiles } = context;

  return {
    driveInfo: drivesInfo[accountId] || { folders: [], files: [], status: 'loading', lastUpdated: '' },
    loading: loadingDrives[accountId] || false,
    error: errors[accountId] || null,
    refreshDriveInfo: () => refreshDriveInfo(accountId, true),
    refreshDriveFiles: () => refreshDriveFiles(accountId, true),
  };
}

// Custom hook to provide aggregated drive data
// This is designed to be used in place of the old useDrive, providing overall state.
export function useDrive() {
  const context = useContext(MultiDriveContext);
  if (context === null) {
    throw new Error('useDrive must be used within a MultiDriveProvider');
  }

  const {
    drivesInfo,
    loadingDrives,
    errors,
    selectedFolder,
    selectFolder,
    clearSelectedFolder,
    refreshDriveInfo,
    refreshDriveFiles,
    driveFiles, // Now directly using the aggregated files from context
    driveFolders, // Now directly using the aggregated folders from context
    loading, // Now directly using the overall loading state from context
    error, // Now directly using the overall error state from context
  } = context;

  return {
    drivesInfo, // All drive info by accountId
    driveFiles, // All files (potentially filtered by selectedFolder)
    driveFolders, // All folders
    loading,
    error,
    selectedFolder,
    selectFolder,
    clearSelectedFolder,
    refreshDriveInfo,
    refreshDriveFiles,
  };
}