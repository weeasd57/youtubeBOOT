'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { useDrive } from '@/contexts/DriveContext';
import { useMultiDrive } from '@/contexts/MultiDriveContext';
import { useMultiChannel } from '@/contexts/MultiChannelContext';
import { useDataFetching } from '@/hooks/useDataFetching';
import { useTikTokVideos } from '@/hooks/useTikTokVideos';

const DashboardContext = createContext(null);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}

export function DashboardProvider({ children }) {
  const { data: session, status } = useSession();

  // 1. State Management
  const [authExpired, setAuthExpired] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [activeContentTab, setActiveContentTab] = useState('schedule');
  const [activeDriveTab, setActiveDriveTab] = useState(null);
  const [activeDriveAccountId, setActiveDriveAccountId] = useState(null);
  const [userTokens, setUserTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [autoUploadEnabled, setAutoUploadEnabled] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  // 2. Context Hooks
  const router = useRouter();
  const driveContext = useDrive() || {};
  const { 
    drivesInfo = {}, 
    loadingDrives = {}, 
    errors: driveErrors = {}, 
    refreshDrive = () => {}, 
    refreshAllDrives
  } = useMultiDrive() || {};

  const { 
    driveFiles = [], 
    driveFolders = [], 
    selectedFolder = null, 
    fetchDriveFiles = () => console.warn('fetchDriveFiles not available'), 
    fetchDriveFolders = () => console.warn('fetchDriveFolders not available'), 
    selectFolder = () => console.warn('selectFolder not available'), 
    clearSelectedFolder = () => console.warn('clearSelectedFolder not available'), 
    loading: foldersLoading = false, 
    error: foldersError = null 
  } = driveContext;

  const { user, loading: userLoading, error: userError, accounts = [] } = useUser();
  const { 
    channelsInfo, 
    loadingChannels, 
    errors: channelErrors, 
    refreshChannel = () => {},
    refreshAllChannels = () => {},
    fetchChannelInfo = () => {}
  } = useMultiChannel();
  const { initialLoading, refreshAll } = useDataFetching() || { initialLoading: false, refreshAll: () => {} };
  const tikTokData = useTikTokVideos();

  // Combined loading and error states
  const loadingCombined = userLoading || foldersLoading || tikTokData.loading;
  const combinedError = userError || foldersError || tikTokData.error;

  // 6. Local Storage Helper
  const safeLocalStorage = useMemo(() => ({
    get: (key, defaultValue = null) => {
      try {
        if (typeof window === 'undefined') return defaultValue;
        const value = localStorage.getItem(key);
        return value !== null ? value : defaultValue;
      } catch (err) {
        console.error(`Error getting ${key} from localStorage:`, err);
        return defaultValue;
      }
    },
    set: (key, value) => {
      try {
        if (typeof window === 'undefined') return false;
        localStorage.setItem(key, value);
        return true;
      } catch (err) {
        console.error(`Error setting ${key} in localStorage:`, err);
        return false;
      }
    },
    getJson: (key, defaultValue = null) => {
      try {
        if (typeof window === 'undefined') return defaultValue;
        const value = localStorage.getItem(key);
        return value !== null ? JSON.parse(value) : defaultValue;
      } catch (err) {
        console.error(`Error parsing ${key} from localStorage:`, err);
        return defaultValue;
      }
    },
    setJson: (key, value) => {
      try {
        if (typeof window === 'undefined') return false;
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (err) {
        console.error(`Error stringifying ${key} for localStorage:`, err);
        return false;
      }
    }
  }), []);

  // Global request deduplication
  const pendingRequests = useRef({
    tokenFetch: null,
    channelInfo: new Map(), // Map of accountId -> Promise
  });

  // Token Management
  const fetchUserTokens = useCallback(async () => {
    if (pendingRequests.current.tokenFetch) {
      return await pendingRequests.current.tokenFetch;
    }
    
    try {
      const lastTokenFetch = safeLocalStorage.get('lastTokenFetch');
      const currentTime = Date.now();
      const minFetchInterval = 30000;
      
      if (lastTokenFetch && (currentTime - parseInt(lastTokenFetch)) < minFetchInterval) {
        const cachedTokens = safeLocalStorage.get('cachedUserTokens');
        if (cachedTokens) {
          setUserTokens(JSON.parse(cachedTokens));
        }
        return;
      }
      
      safeLocalStorage.set('lastTokenFetch', currentTime.toString());
      setLoadingTokens(true);
      
      const tokenPromise = fetch('/api/user-tokens', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      pendingRequests.current.tokenFetch = tokenPromise;
      const response = await tokenPromise;
      const data = await response.json();

      if (response.ok) {
        if (data.tokens && data.tokens.length > 0) {
          safeLocalStorage.set('cachedUserTokens', JSON.stringify(data.tokens));
        }
        setUserTokens(data.tokens || []);
      } else {
        setUserTokens([]);
      }
    } catch (error) {
      console.error('Error fetching user tokens:', error);
      setUserTokens([]);
    } finally {
      setLoadingTokens(false);
      pendingRequests.current.tokenFetch = null;
    }
  }, [accounts, safeLocalStorage]);

  // Channel info is now handled by MultiChannelContext
  const refreshChannelInfo = useCallback((accountId) => {
    if (accountId) {
      refreshChannel(accountId);
    }
  }, [refreshChannel]);

  const debouncedFetchUserTokens = useCallback(() => {
    const lastCall = safeLocalStorage.get('lastTokenFetchCall', '0');
    const now = Date.now();
    const minInterval = 2000;
    if (now - parseInt(lastCall) < minInterval) {
      return;
    }
    safeLocalStorage.set('lastTokenFetchCall', now.toString());
    fetchUserTokens();
  }, [fetchUserTokens, safeLocalStorage]);

  const handleAccountClick = useCallback((accountId) => {
    setActiveDriveTab(accountId);
    if (accountId !== activeDriveAccountId) {
      setActiveDriveAccountId(accountId);
    } else {
      if (refreshDrive) refreshDrive(accountId);
      if (refreshChannel) refreshChannel(accountId);
    }
  }, [activeDriveAccountId, refreshDrive, refreshChannel]);

  const handleRefreshSuccess = () => {
    setAuthExpired(false);
    refreshAll(true);
  };

  const handleRefreshError = () => {
    signOut({ callbackUrl: '/' });
  };

  const syncDriveChanges = useCallback(async (forceSync = false) => {
    try {
      await fetchDriveFiles(forceSync);
      setLastChecked(new Date());
    } catch (error) {
      console.error('Error syncing drive changes:', error);
    }
  }, [fetchDriveFiles]);

  const refreshFolders = useCallback(async () => {
    if (foldersLoading) return; // Avoid multiple simultaneous refreshes
    
    const lastFolderRefresh = safeLocalStorage.get('lastHomeFolderRefresh');
    const currentTime = Date.now();
    const minRefreshInterval = 180000; // 3 minutes (increased from 30 seconds)
    
    if (lastFolderRefresh && (currentTime - parseInt(lastFolderRefresh)) < minRefreshInterval) {
      console.log('Skipping folder refresh - requested too frequently');
      return;
    }
    
    safeLocalStorage.set('lastHomeFolderRefresh', currentTime.toString());
    
    try {
      console.log('Refreshing folders with force refresh...');
      if (typeof window !== 'undefined') {
        window._lastDriveFoldersApiCall = 0;
      }
      await fetchDriveFolders(true);
    } catch (error) {
      console.error('Error refreshing folders:', error);
      try {
        if (session?.accessToken) {
          await fetch('/api/drive-refreshtoken?force=true');
          await fetchDriveFolders(true);
        }
      } catch (retryError) {
        console.error('Failed to refresh folders after token refresh:', retryError);
      }
    }
  }, [fetchDriveFolders, session, foldersLoading, safeLocalStorage]);

  const checkNewVideos = useCallback(() => {
    console.log('Checking for new videos (auto-upload feature)');
    // Actual implementation would go here
  }, []);

  const availableAccounts = useMemo(() => {
    // Build a map so we can merge data from multiple sources without duplicates
    const combinedMap = new Map();

    // 1️⃣ Add accounts coming from the main `accounts` table
    (accounts || []).forEach(acc => combinedMap.set(acc.id, acc));

    // 2️⃣ Overlay with `userTokens` – they often contain up-to-date name/email even
    // for accounts that don't exist yet in the `accounts` table.
    (userTokens || []).forEach(tok => {
      const existing = combinedMap.get(tok.id) || {};
      combinedMap.set(tok.id, { ...existing, ...tok });
    });

    // 3️⃣ Ensure every Drive account that appears in `drivesInfo` is represented
    // so the UI still works even if we lack DB info for that ID.
    Object.keys(drivesInfo || {}).forEach(id => {
      if (!combinedMap.has(id)) {
        combinedMap.set(id, { id, name: `Account ${id.substring(0, 6)}`, email: 'N/A' });
      }
    });

    return Array.from(combinedMap.values());
  }, [accounts, userTokens, drivesInfo]);

  const mergedAccounts = useMemo(() => {
    return userTokens?.length > 0 ? userTokens : availableAccounts;
  }, [userTokens, availableAccounts]);

  const filteredItems = useMemo(() => {
    if (!driveFiles || driveFiles.length === 0) return [];
    if (!selectedFolder) return driveFiles;
    return driveFiles.filter(item => item.parents && item.parents.includes(selectedFolder.id));
  }, [driveFiles, selectedFolder]);

  const handleScheduleSelect = (file) => {
    if (selectedFiles.some(f => f.id === file.id)) {
      setSelectedFiles(selectedFiles.filter(f => f.id !== file.id));
    } else {
      const tikTokFileData = tikTokData?.getTikTokDataForDriveFile?.(file.id);
      const enhancedFile = tikTokFileData ? { ...file, ...tikTokFileData } : file;
      setSelectedFiles([...selectedFiles, enhancedFile]);
    }
  };

  const selectAllFiles = async () => {
    if (selectedFiles.length === filteredItems.length) {
      setSelectedFiles([]);
    } else {
      setSelectingAll(true);
      setProcessingProgress(0);
      const enhancedFiles = await Promise.all(filteredItems.map(async (file, index) => {
        const tikTokFileData = tikTokData?.getTikTokDataForDriveFile?.(file.id);
        setProcessingProgress(Math.round(((index + 1) / filteredItems.length) * 100));
        return tikTokFileData ? { ...file, ...tikTokFileData } : file;
      }));
      setSelectedFiles(enhancedFiles);
      setSelectingAll(false);
    }
  };

  const handleFolderSelect = async (e) => {
    const folderId = e.target.value;
    if (folderId === 'all') {
      clearSelectedFolder();
    } else {
      const folder = currentDriveFolders.find(f => f.id === folderId) || driveFolders.find(f => f.id === folderId);
      if (folder) {
        selectFolder(folder);
      }
    }
  };

  const currentDriveFolders = useMemo(() => {
    if (!activeDriveAccountId) return driveFolders;
    return drivesInfo[activeDriveAccountId]?.folders || driveFolders;
  }, [activeDriveAccountId, drivesInfo, driveFolders]);

  // Effects
  useEffect(() => {
    if (session?.error === 'reauthenticate_required' || combinedError?.includes('Authentication expired')) {
      setAuthExpired(true);
    }
  }, [session, combinedError]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Initial data load effect
  useEffect(() => {
    if (session?.user && !authExpired) {
      const loadInitialData = async () => {
        try {
          await fetchDriveFolders(false);
          await debouncedFetchUserTokens();
        } catch (error) {
          console.error('Error loading initial data:', error);
        }
      };
      loadInitialData();
    }
  }, [session?.user, authExpired]); // Removed dependencies that could cause loops

  // Set initial active account from mergedAccounts
  useEffect(() => {
    if (mergedAccounts.length > 0 && !activeDriveAccountId) {
      const storedAccountId = safeLocalStorage.get('activeDriveAccountId');
      const accountToSet = storedAccountId && mergedAccounts.some(acc => acc.id === storedAccountId)
        ? storedAccountId
        : mergedAccounts[0]?.id;
      
      if (accountToSet) {
        setActiveDriveAccountId(accountToSet);
        setActiveDriveTab(accountToSet);
      }
    }
  }, [mergedAccounts, activeDriveAccountId, safeLocalStorage]);

  // Refresh data when active account changes
  useEffect(() => {
    if (activeDriveAccountId) {
      // Only update storage if the value has actually changed
      safeLocalStorage.set('activeDriveAccountId', activeDriveAccountId);
      
      // Use a small timeout to prevent rapid successive updates
      const timer = setTimeout(() => {
        refreshDrive(activeDriveAccountId);
        refreshChannel(activeDriveAccountId);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [activeDriveAccountId, refreshDrive, refreshChannel, safeLocalStorage]);

  // Initialize active account from localStorage - only on mount
  useEffect(() => {
    const storedAccountId = safeLocalStorage.get('activeDriveAccountId');
    if (storedAccountId && !activeDriveAccountId) {
      setActiveDriveAccountId(storedAccountId);
      setActiveDriveTab(storedAccountId);
    }
  }, []); // Empty dependency array means this runs once on mount

  // Auto-upload feature effect
  const checkNewVideosRef = useRef(checkNewVideos);
  checkNewVideosRef.current = checkNewVideos;
  useEffect(() => {
    let interval;
    if (session && autoUploadEnabled) {
      interval = setInterval(() => {
        checkNewVideosRef.current();
      }, 5 * 60 * 1000); // Check every 5 minutes
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session, autoUploadEnabled]);

  // Fetch tokens if accounts are missing after initial load
  useEffect(() => {
    if (!initialLoading && session?.user && (!accounts || accounts.length === 0)) {
      console.log('No accounts found after initial loading, checking for tokens');
      const timer = setTimeout(() => {
        debouncedFetchUserTokens();
      }, 1000); // Small delay to prevent immediate refetching
      
      return () => clearTimeout(timer);
    }
  }, [initialLoading, session?.user, accounts, debouncedFetchUserTokens]);

  const value = {
    session, status, authExpired, selectedFiles, setSelectedFiles, error, lastChecked, activeContentTab, setActiveContentTab, activeDriveTab, setActiveDriveTab, activeDriveAccountId, setActiveDriveAccountId, userTokens, loadingTokens, autoUploadEnabled, setAutoUploadEnabled, selectingAll, processingProgress, router, driveContext, drivesInfo, loadingDrives, driveErrors, refreshDrive, refreshAllDrives, driveFiles, driveFolders, selectedFolder, fetchDriveFiles, fetchDriveFolders, selectFolder, clearSelectedFolder, foldersLoading, foldersError, user, userLoading, userError, accounts, channelsInfo, loadingChannels, channelErrors, refreshChannel, initialLoading, refreshAll, tikTokData, loadingCombined, combinedError, handleAccountClick, handleRefreshSuccess, handleRefreshError, syncDriveChanges, availableAccounts, mergedAccounts, filteredItems, handleScheduleSelect, selectAllFiles, handleFolderSelect, currentDriveFolders, refreshFolders, fetchChannelInfo,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
