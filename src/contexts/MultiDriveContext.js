import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useUser } from './UserContext';
import { useSession } from 'next-auth/react';
import { fetchDriveFoldersWithCache, fetchDriveFilesWithCache } from '@/utils/driveHelpers';

// Optimized timing constants
const DEBOUNCE_DELAY = 150; // Reduced from 300ms
const THROTTLE_DELAY = 2000; // Reduced from 5000ms
const GLOBAL_REFRESH_DELAY = 30000; // Reduced from 60000ms
const BATCH_SIZE = 3; // Number of concurrent requests
const STAGGER_DELAY = 500; // Delay between batches

const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// Create context
const MultiDriveContext = createContext();

export function MultiDriveProvider({ children }) {
  const [drivesInfo, setDrivesInfo] = useState({});
  const [loadingDrives, setLoadingDrives] = useState({});
  const [errors, setErrors] = useState({});
  const { accounts } = useUser();
  const { data: session } = useSession();
  
  const accountsRef = useRef(null);
  const pendingFetches = useRef(new Map());
  const lastFetchTimes = useRef(new Map());
  const mounted = useRef(true);
  const loadingDrivesRef = useRef({});

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

  // Token refresh handling
  const handleAuthError = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session');
      if (!response.ok) return false;

      const sessionData = await response.json();
      if (!sessionData?.user) return false;

      const accountId = accounts?.[0]?.id || session?.user?.id;
      if (!accountId) return false;

      const tokenResponse = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      return tokenResponse.ok;
    } catch (error) {
      return false;
    }
  }, [accounts, session]);

  // Data comparison utility
  const hasDataChanged = useCallback((oldData, newData, keys = ['id', 'name']) => {
    if (!oldData || !newData) return true;
    if (oldData.length !== newData.length) return true;
    return newData.some((newItem, index) => {
      const oldItem = oldData[index];
      return !oldItem || keys.some(key => oldItem[key] !== newItem[key]);
    });
  }, []);

  // Drive info fetching with optimizations
  const fetchDriveInfo = useCallback(async (accountId, forceRefresh = false) => {
    if (!accountId || !mounted.current) return;
    if (loadingDrivesRef.current[accountId] && !forceRefresh) return;

    const now = Date.now();
    const lastFetch = lastFetchTimes.current.get(accountId);
    if (!forceRefresh && lastFetch && (now - lastFetch < THROTTLE_DELAY)) {
      return;
    }

    if (pendingFetches.current.has(accountId)) {
      try {
        return await pendingFetches.current.get(accountId);
      } catch {
        pendingFetches.current.delete(accountId);
      }
    }

    setLoadingDrives(prev => ({ ...prev, [accountId]: true }));
    setErrors(prev => ({ ...prev, [accountId]: null }));

    const fetchPromise = (async () => {
      try {
        const result = await fetchDriveFoldersWithCache({
          forceRefresh,
          accountId,
          onFolderCheck: () => {},
        });

        if (!mounted.current) return;

        if (result.success) {
          setDrivesInfo(prev => {
            const accountInfo = {
              folders: [],
              files: [],
              ...(prev[accountId] || {}),
            };

            const oldFolders = Array.isArray(accountInfo.folders) ? accountInfo.folders : [];
            const newFolders = result.folders || [];

            if (!hasDataChanged(oldFolders, newFolders)) {
              return prev;
            }

            return {
              ...prev,
              [accountId]: {
                ...accountInfo,
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
              folders: [],
              files: [],
              status: 'no_data',
              lastUpdated: new Date().toISOString(),
            },
          }));

          if (result.error) {
            setErrors(prev => ({ ...prev, [accountId]: result.error }));
          }
        }

        return result;
      } catch (error) {
        if (!mounted.current) return;
        
        setErrors(prev => ({
          ...prev,
          [accountId]: error.message || 'An unexpected error occurred',
        }));
        throw error;
      } finally {
        if (mounted.current) {
          setLoadingDrives(prev => ({ ...prev, [accountId]: false }));
        }
        pendingFetches.current.delete(accountId);
        lastFetchTimes.current.set(accountId, Date.now());
      }
    })();

    pendingFetches.current.set(accountId, fetchPromise);
    return fetchPromise;
  }, [loadingDrivesRef, hasDataChanged]);

  // File fetching with optimizations
  const fetchDriveFiles = useCallback(async (accountId, forceRefresh = false) => {
    if (!accountId || !mounted.current || (loadingDrives[accountId] && !forceRefresh)) return;

    const now = Date.now();
    const lastFetch = lastFetchTimes.current.get(`${accountId}_files`);
    if (!forceRefresh && lastFetch && (now - lastFetch < THROTTLE_DELAY)) {
      return;
    }

    setLoadingDrives(prev => ({ ...prev, [accountId]: true }));

    try {
      const result = await fetchDriveFilesWithCache({
        forceRefresh,
        accountId,
        folderId: null,
      });

      if (!mounted.current) return;

      if (result.success) {
        setDrivesInfo(prev => {
          const accountInfo = {
            folders: [],
            files: [],
            ...(prev[accountId] || {}),
          };

          const oldFiles = Array.isArray(accountInfo.files) ? accountInfo.files : [];
          const newFiles = result.files || [];

          if (!hasDataChanged(oldFiles, newFiles)) {
            return prev;
          }

          return {
            ...prev,
            [accountId]: {
              ...accountInfo,
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
            files: [],
            status: 'no_data',
            lastUpdated: new Date().toISOString(),
          },
        }));

        setErrors(prev => ({
          ...prev,
          [accountId]: result.error || 'Failed to fetch drive files',
        }));
      }
    } catch (error) {
      if (!mounted.current) return;

      setErrors(prev => ({
        ...prev,
        [accountId]: error.message || 'An unexpected error occurred',
      }));
    } finally {
      if (mounted.current) {
        setLoadingDrives(prev => ({ ...prev, [accountId]: false }));
      }
      lastFetchTimes.current.set(`${accountId}_files`, Date.now());
    }
  }, [loadingDrives, hasDataChanged]);

  // Debounced refresh
  const debouncedRefresh = useMemo(() => 
    debounce((accountId, force) => {
      if (!accountId || !mounted.current) return;
      
      const lastUpdate = drivesInfo[accountId]?.lastUpdated;
      const now = Date.now();
      
      if (!force && lastUpdate) {
        const timeSinceLastUpdate = now - new Date(lastUpdate).getTime();
        if (timeSinceLastUpdate < THROTTLE_DELAY) return;
      }
      
      return fetchDriveInfo(accountId, force);
    }, DEBOUNCE_DELAY),
    [drivesInfo, fetchDriveInfo]
  );

  // Public refresh method
  const refreshDrive = useCallback((accountId, force = false) => {
    return debouncedRefresh(accountId, force);
  }, [debouncedRefresh]);

  // Account initialization
  useEffect(() => {
    if (!accounts?.length || !mounted.current) return;

    const accountIds = accounts.map(acc => acc.id).sort().join(',');
    if (accountsRef.current === accountIds) return;

    accountsRef.current = accountIds;

    const initialState = accounts.reduce((acc, account) => {
      if (!drivesInfo[account.id]) {
        acc.loading[account.id] = false;
        acc.errors[account.id] = null;
      }
      return acc;
    }, { loading: {}, errors: {} });

    if (Object.keys(initialState.loading).length > 0) {
      setLoadingDrives(prev => ({ ...prev, ...initialState.loading }));
      setErrors(prev => ({ ...prev, ...initialState.errors }));
    }

    accounts.forEach(account => {
      if (!drivesInfo[account.id]) {
        fetchDriveInfo(account.id, false);
      }
    });
  }, [accounts, drivesInfo, fetchDriveInfo]);

  // Account switching handler
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAccountSwitch = debounce(async (e) => {
      if (e.key !== 'accountSwitched' || e.newValue !== 'true') return;
      localStorage.removeItem('accountSwitched');

      const currentAccount = accountsRef.current?.[0];
      if (!currentAccount?.id || !mounted.current) return;

      await fetchDriveInfo(currentAccount.id, true);
      if (mounted.current) {
        setTimeout(() => {
          if (mounted.current) {
            fetchDriveFiles(currentAccount.id, true);
          }
        }, 500);
      }
    }, DEBOUNCE_DELAY);

    window.addEventListener('storage', handleAccountSwitch);
    return () => window.removeEventListener('storage', handleAccountSwitch);
  }, [fetchDriveInfo, fetchDriveFiles]);

  // Optimized batch refresh handler
  const refreshAllDrives = useCallback(() => {
    if (!accounts?.length || !mounted.current) return;

    const now = Date.now();
    const lastGlobalUpdate = localStorage.getItem('lastGlobalDriveUpdate');
    
    if (lastGlobalUpdate) {
      const timeSinceLastUpdate = now - parseInt(lastGlobalUpdate);
      if (timeSinceLastUpdate < GLOBAL_REFRESH_DELAY) return;
    }

    localStorage.setItem('lastGlobalDriveUpdate', now.toString());

    // Process accounts in batches
    const processBatch = async (accountsBatch) => {
      const batchPromises = accountsBatch.map(account => {
        if (!mounted.current) return Promise.resolve();
        
        return (async () => {
          try {
            await fetchDriveInfo(account.id, true);
            if (mounted.current) {
              await fetchDriveFiles(account.id, true);
            }
          } catch (error) {
            console.error(`Error processing account ${account.id}:`, error);
          }
        })();
      });

      await Promise.all(batchPromises);
    };

    // Split accounts into batches and process them
    const processBatches = async () => {
      for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
        if (!mounted.current) break;
        
        const batch = accounts.slice(i, i + BATCH_SIZE);
        await processBatch(batch);
        
        // Stagger the next batch
        if (i + BATCH_SIZE < accounts.length) {
          await new Promise(resolve => setTimeout(resolve, STAGGER_DELAY));
        }
      }
    };

    processBatches().catch(error => {
      console.error('Error in batch processing:', error);
    });
  }, [accounts, fetchDriveInfo, fetchDriveFiles]);

  // Memoized helper functions
  const getDriveFiles = useCallback((accountId) => 
    drivesInfo[accountId]?.files || [], [drivesInfo]);

  const getDriveFolders = useCallback((accountId) => 
    drivesInfo[accountId]?.folders || [], [drivesInfo]);

  const isDriveLoading = useCallback((accountId) => 
    loadingDrives[accountId] || false, [loadingDrives]);

  const getDriveError = useCallback((accountId) => 
    errors[accountId] || null, [errors]);

  const getSelectedDriveContext = useCallback((accountId) => ({
    files: drivesInfo[accountId]?.files || [],
    folders: drivesInfo[accountId]?.folders || [],
    loading: loadingDrives[accountId] || false,
    error: errors[accountId] || null,
  }), [drivesInfo, loadingDrives, errors]);

  // Memoized context value
  const value = useMemo(() => ({
    drivesInfo,
    loadingDrives,
    errors,
    refreshDrive,
    refreshAllDrives,
    fetchDriveInfo,
    fetchDriveFiles,
    getSelectedDriveContext,
    handleAuthError,
    getDriveFiles,
    getDriveFolders,
    isDriveLoading,
    getDriveError,
  }), [
    drivesInfo,
    loadingDrives,
    errors,
    refreshDrive,
    refreshAllDrives,
    fetchDriveInfo,
    fetchDriveFiles,
    getSelectedDriveContext,
    handleAuthError,
    getDriveFiles,
    getDriveFolders,
    isDriveLoading,
    getDriveError,
  ]);

  return (
    <MultiDriveContext.Provider value={value}>
      {children}
    </MultiDriveContext.Provider>
  );
}

export function useMultiDrive() {
  const context = useContext(MultiDriveContext);
  if (context === undefined) {
    throw new Error('useMultiDrive must be used within a MultiDriveProvider');
  }
  return context;
}

export function useSingleDrive(accountId) {
  const context = useContext(MultiDriveContext);
  if (context === undefined) {
    throw new Error('useSingleDrive must be used within a MultiDriveProvider');
  }

  return useMemo(() => ({
    driveFiles: context.drivesInfo[accountId]?.files || [],
    driveFolders: context.drivesInfo[accountId]?.folders || [],
    loading: context.loadingDrives[accountId] || false,
    error: context.errors[accountId] || null,
    refreshDrive: () => context.refreshDrive(accountId),
    fetchFiles: () => context.fetchDriveFiles(accountId),
    fetchFolders: () => context.fetchDriveInfo(accountId),
  }), [context, accountId]);
}

export function useDrive() {
  const context = useContext(MultiDriveContext);
  const { accounts } = useUser();
  
  if (context === undefined) {
    throw new Error('useDrive must be used within a MultiDriveProvider');
  }

  const accountId = accounts?.[0]?.id;

  return useMemo(() => ({
    driveFiles: context.drivesInfo[accountId]?.files || [],
    driveFolders: context.drivesInfo[accountId]?.folders || [],
    loading: context.loadingDrives[accountId] || false,
    error: context.errors[accountId] || null,
    selectedFile: null,
    refreshDrive: () => context.refreshDrive(accountId),
    fetchDriveFiles: () => context.fetchDriveFiles(accountId),
    fetchDriveFolders: () => context.fetchDriveInfo(accountId),
    handleAuthError: context.handleAuthError,
    selectFile: () => {},
    clearSelectedFile: () => {},
  }), [context, accountId]);
}