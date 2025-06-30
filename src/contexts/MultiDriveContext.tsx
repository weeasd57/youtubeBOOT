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
  activeAccountDriveInfo: DriveInfo | null;
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
  
  // Get activeAccount from AccountContext
  const { accounts, activeAccount, loading: accountsLoading } = useAccounts();
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

  // Token refresh handling - ensure it uses the active account
  const handleAuthError = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session');
      if (!response.ok) return false;

      const sessionData = await response.json();
      if (!sessionData?.user) return false;

      const accountId = activeAccount?.id; // Use activeAccount.id here
      if (!accountId) {
        console.warn('[MultiDriveContext] No active account ID for auth error handling.');
        return false;
      }

      const tokenResponse = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      return tokenResponse.ok;
    } catch (error: any) {
      console.error('[MultiDriveContext] Error in handleAuthError:', error);
      return false;
    }
  }, [activeAccount]);

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
          setLoadingState: () => {},
          setFoldersState: () => {},
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

    try {
      console.log(`[MultiDriveContext] fetchDriveFiles: Starting fetch for ${accountId}.`);
      const result = await fetchDriveFilesWithCache({
        forceRefresh,
        accountId,
        folderId: selectedFolder?.id || null,
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
  }, [loadingDrives, hasDataChanged, selectedFolder]);

  // Refresh all drive info for a user
  const refreshAllDrives = useCallback(async (forceRefresh = false) => {
    if (accountsLoading) {
      console.log('[MultiDriveContext] refreshAllDrives: Accounts still loading, skipping.');
      return;
    }

    // Filter out accounts that are already loading or don't have an active token
    const accountsToRefresh = accounts.filter(account => 
      !loadingDrivesRef.current[account.id] && 
      account.access_token
    );

    if (accountsToRefresh.length === 0) {
      console.log('[MultiDriveContext] No accounts to refresh or all are loading.');
      return;
    }

    console.log(`[MultiDriveContext] Refreshing ${accountsToRefresh.length} drives...`);

    const processBatch = async (accountsBatch: Account[]) => {
      await Promise.all(accountsBatch.map(account => 
        Promise.all([
          fetchDriveInfo(account.id, forceRefresh),
          fetchDriveFiles(account.id, forceRefresh)
        ])
      ));
    };

    // Batch processing to prevent too many concurrent requests
    for (let i = 0; i < accountsToRefresh.length; i += BATCH_SIZE) {
      const batch = accountsToRefresh.slice(i, i + BATCH_SIZE);
      await processBatch(batch);
      if (i + BATCH_SIZE < accountsToRefresh.length) {
        await new Promise(resolve => setTimeout(resolve, STAGGER_DELAY));
      }
    }
    console.log('[MultiDriveContext] All drives refresh complete.');
  }, [accounts, accountsLoading, fetchDriveInfo, fetchDriveFiles]);

  // Debounced refresh for initial load
  useEffect(() => {
    // Only run initial fetch if not already loading and accounts are available
    if (!accountsLoading && accounts.length > 0 && Object.keys(drivesInfo).length === 0) {
      console.log('[MultiDriveContext] Initializing drive data refresh.');
      refreshAllDrives(false);
    }
  }, [accounts, accountsLoading, drivesInfo, refreshAllDrives]);

  // Fetch drive info for active account when activeAccount changes
  useEffect(() => {
    if (activeAccount && !accountsLoading) {
      console.log(`[MultiDriveContext] Active account changed to ${activeAccount.id}. Fetching drive info.`);
      fetchDriveInfo(activeAccount.id, false);
      fetchDriveFiles(activeAccount.id, false);
      setSelectedFolder(null);
    }
  }, [activeAccount, accountsLoading, fetchDriveInfo, fetchDriveFiles]);

  // Memoize the context value
  const value = useMemo<MultiDriveContextType>(() => {
    const activeAccountDriveInfo = activeAccount ? drivesInfo[activeAccount.id] || { folders: [], files: [], status: 'loading', lastUpdated: '' } : null;
    
    // Filter files and folders based on active account and selected folder
    const driveFiles = activeAccountDriveInfo?.files || [];
    const driveFolders = activeAccountDriveInfo?.folders || [];
    const loading = activeAccount ? loadingDrives[activeAccount.id] || false : accountsLoading;
    const error = activeAccount ? errors[activeAccount.id] || null : null;

    return {
      drivesInfo,
      loadingDrives,
      errors,
      refreshDriveInfo: (accountId, forceRefresh) => fetchDriveInfo(accountId, forceRefresh),
      refreshDriveFiles: (accountId, forceRefresh) => fetchDriveFiles(accountId, forceRefresh),
      activeAccountDriveInfo,
      driveFiles: selectedFolder 
        ? driveFiles.filter(file => file.parents && file.parents.includes(selectedFolder.id))
        : driveFiles,
      driveFolders,
      loading,
      error,
      selectedFolder,
      selectFolder: setSelectedFolder,
      clearSelectedFolder: () => setSelectedFolder(null),
    };
  }, [drivesInfo, loadingDrives, errors, activeAccount, accountsLoading, fetchDriveInfo, fetchDriveFiles, selectedFolder]);

  return (
    <MultiDriveContext.Provider value={value}>
      {children}
    </MultiDriveContext.Provider>
  );
}

// Custom hook for using the MultiDriveContext directly
export function useMultiDrive() {
  const context = useContext(MultiDriveContext);
  if (context === null) {
    throw new Error('useMultiDrive must be used within a MultiDriveProvider');
  }
  return context;
}

// Custom hook to get specific drive info for a single account
export function useSingleDrive(accountId: string) {
  const context = useContext(MultiDriveContext);
  const singleDriveContext = useMemo(() => {
    if (!context || !accountId) {
      return {
        driveInfo: null,
        loading: false,
        error: null,
        fetchDriveInfo: () => Promise.resolve(null),
        fetchDriveFiles: () => Promise.resolve(null),
      };
    }

    const driveInfo = context.drivesInfo[accountId] || null;
    const loading = context.loadingDrives[accountId] || false;
    const error = context.errors[accountId] || null;

    return {
      driveInfo,
      loading,
      error,
      fetchDriveInfo: (force = false) => context.refreshDriveInfo(accountId, force),
      fetchDriveFiles: (force = false) => context.refreshDriveFiles(accountId, force),
    };
  }, [context, accountId]);

  return singleDriveContext;
}

// Simplified hook for general drive access (for HomeDashboardContent)
export function useDrive() {
  const context = useContext(MultiDriveContext);
  const { activeAccount } = useAccounts();
  if (context === null) {
    throw new Error('useDrive must be used within a MultiDriveProvider');
  }
  
  // Destructure simplified props directly
  const { driveFiles, driveFolders, loading, error, selectedFolder, selectFolder, clearSelectedFolder, refreshDriveFiles: contextRefreshDriveFiles } = context;

  return {
    driveFiles,
    driveFolders,
    loading,
    error,
    selectedFolder,
    selectFolder,
    clearSelectedFolder,
    refreshDriveFiles: (force = false) => {
      if (!activeAccount?.id) {
        console.warn('No active account selected for refreshing drive files.');
        return Promise.resolve(null);
      }
      return contextRefreshDriveFiles(activeAccount.id, force);
    },
  };
}