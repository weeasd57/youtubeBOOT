'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { FaUpload, FaSync, FaHistory, FaEye, FaThumbsUp, FaCalendarAlt, FaClock, FaCloudUploadAlt, FaTable, FaDownload, FaHashtag, FaTiktok, FaExclamationTriangle } from 'react-icons/fa';
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { useDrive } from '@/contexts/DriveContext';
import { useUpload } from '@/contexts/UploadContext';
import { useYouTube } from '@/contexts/YouTubeContext';
import { useMultiChannel } from '@/contexts/MultiChannelContext';
import { useMultiDrive } from '@/contexts/MultiDriveContext';
import { useDataFetching } from '@/hooks/useDataFetching';
import dynamic from 'next/dynamic';
import ClientOnly from '@/components/ClientOnly';
import ThemeToggle from '@/components/ThemeToggle';
import ScheduleUploadForm from '@/components/ScheduleUploadForm';
import AuthErrorBanner from '@/components/AuthErrorBanner';
import UploadProgress from '@/components/UploadProgress';
import QuotaErrorMessage from '@/components/QuotaErrorMessage';
import AutoRefresh from '@/components/AutoRefresh';
import RefreshButton from '@/components/RefreshButton';
import YouTubeConnectionStatus from '@/components/YouTubeConnectionStatus';
import Navbar from '@/components/Navbar';
import PageContainer from '@/components/PageContainer';
import DriveThumbnail from '@/components/DriveThumbnail';
import FileListItem from '@/components/FileListItem';

// استيراد useTikTokVideos بشكل شرطي
const UseTikTokVideosComponent = dynamic(() => import('@/hooks/useTikTokVideos').then(mod => ({ default: mod.useTikTokVideos })), {
  ssr: false,
  loading: () => null,
});

// Helper function to extract hashtags from text
const extractHashtags = (text) => {
  if (!text) return [];
  
  // Match hashtags (words starting with # followed by letters/numbers)
  const hashtagRegex = /#[a-zA-Z0-9_]+/g;
  const matches = text.match(hashtagRegex) || [];
  
  // Return unique hashtags
  return [...new Set(matches)];
};

// Helper function to generate a clean title from filename
const generateCleanTitle = (fileName) => {
  if (!fileName) return '';
  
  // Remove file extension
  let title = fileName.replace(/\.(mp4|mov|avi|mkv|wmv)$/i, '');
  
  // Remove hashtags
  title = title.replace(/#[a-zA-Z0-9_]+/g, '').trim();
  
  // Replace underscores and hyphens with spaces
  title = title.replace(/[_-]/g, ' ');
  
  // Capitalize first letter of each word
  title = title.replace(/\b\w/g, c => c.toUpperCase());
  
  // Remove any extra spaces
  title = title.replace(/\s+/g, ' ').trim();
  
  return title;
};

// Add a custom app logo component for consistency
const AppLogoIcon = ({ className = "", size = 24 }) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    <Image 
      src="/android-chrome-192x192.png" 
      alt="App Logo"
      fill
      className="object-cover"
    />
  </div>
);

export default function Home() {
  // Prevent server-side rendering issues
  const [isMounted, setIsMounted] = useState(false);
  
  // Use Next.js hooks with checks for SSR
  const router = useRouter();
  
  // Call useSession at the top level of the component
  const { data: session, status } = useSession();
  
  // Initialize with client-side rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Don't render anything on the server or during initial mount
  if (!isMounted) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center dark:bg-black" suppressHydrationWarning>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" suppressHydrationWarning></div>
      </div>
    );
  }
  
  // Now we can safely use the actual component with client-side data
  return (
    <PageContainer 
      user={session?.user} 
      onRefresh={null}
      error={null}
    >
      <HomeDashboard 
        session={session}
        status={status}
      />
    </PageContainer>
  );
}

// Separate component that only renders on the client
function HomeDashboard({ session, status }) {
  const router = useRouter();
  
  // Use optional chaining and provide default values for drive context
  const driveContext = useDrive() || {};
  
  // Add MultiDrive context
  const { 
    drivesInfo = {}, 
    loadingDrives = {}, 
    errors: driveErrors = {}, 
    refreshDrive, 
    refreshAllDrives
  } = useMultiDrive() || {};
  
  // Destructure with default values to prevent errors if context is not available
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
  
  console.log('Drive context state:', { 
    hasDriveFiles: Array.isArray(driveFiles), 
    filesCount: driveFiles?.length || 0,
    foldersCount: driveFolders?.length || 0,
    hasError: !!foldersError,
    error: foldersError
  });
  
  // Debug MultiDrive context state
  console.log('MultiDrive context state:', {
    accountsWithDrives: Object.keys(drivesInfo).length,
    loadingAccounts: Object.keys(loadingDrives).filter(key => loadingDrives[key]).length,
    hasErrors: Object.keys(driveErrors).some(key => driveErrors[key])
  });
  
  const { user, loading: userLoading, error: userError, accounts = [] } = useUser();
  
  // Debug log to track component state
  console.log('HomeDashboard state - status:', status, 'userLoading:', userLoading, 'accounts:', accounts, 'userError:', userError);
  
  // Use MultiChannel context for working with multiple YouTube channels
  const { channelsInfo, loadingChannels, errors: channelErrors, refreshChannel } = useMultiChannel();

  // Use data fetching hook for common loading states
  const { initialLoading, refreshAll } = useDataFetching() || { initialLoading: false, refreshAll: () => {} };

  // Use TikTok videos hook if available
  const tikTokData = UseTikTokVideosComponent ? UseTikTokVideosComponent() : { 
    loading: false, 
    error: null,
    getTikTokDataForDriveFile: () => null 
  };
  
  // Feature flag for TikTok functionality
  const tikTokFeatureEnabled = !!UseTikTokVideosComponent;

  // State management
  const [authExpired, setAuthExpired] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [activeContentTab, setActiveContentTab] = useState('schedule'); // Active content tab state
  const [activeDriveTab, setActiveDriveTab] = useState(null); // State for active drive account tab
  const [activeDriveAccountId, setActiveDriveAccountId] = useState(null); // State for active drive account ID
  const [userTokens, setUserTokens] = useState([]); // User tokens from API
  const [loadingTokens, setLoadingTokens] = useState(false);
  
  // Auto-upload related functionality
  const [autoUploadEnabled, setAutoUploadEnabled] = useState(false);
  
  // Safe localStorage helper
  const safeLocalStorage = {
    get: (key, defaultValue = null) => {
      try {
        const value = localStorage.getItem(key);
        return value !== null ? value : defaultValue;
      } catch (err) {
        console.error(`Error getting ${key} from localStorage:`, err);
        return defaultValue;
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (err) {
        console.error(`Error setting ${key} in localStorage:`, err);
        return false;
      }
    },
    getJson: (key, defaultValue = null) => {
      try {
        const value = localStorage.getItem(key);
        return value !== null ? JSON.parse(value) : defaultValue;
      } catch (err) {
        console.error(`Error parsing ${key} from localStorage:`, err);
        return defaultValue;
      }
    },
    setJson: (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (err) {
        console.error(`Error stringifying ${key} for localStorage:`, err);
        return false;
      }
    }
  };
  
  // Function to fetch user tokens
  const fetchUserTokens = useCallback(async () => {
    try {
      // Add rate limiting to prevent excessive API calls
      const lastTokenFetch = localStorage.getItem('lastTokenFetch');
      const currentTime = Date.now();
      const minFetchInterval = 30000; // 30 seconds between fetches
      
      if (lastTokenFetch && (currentTime - parseInt(lastTokenFetch)) < minFetchInterval) {
        console.log('Skipping token fetch - requested too frequently');
        
        // Try to use cached tokens if available
        try {
          const cachedTokens = localStorage.getItem('cachedUserTokens');
          if (cachedTokens) {
            const parsedTokens = JSON.parse(cachedTokens);
            console.log('Using cached tokens:', parsedTokens.length);
            setUserTokens(parsedTokens);
            return;
          }
        } catch (cacheError) {
          console.error('Error parsing cached tokens:', cacheError);
        }
        
        // If no cached tokens, try to use accounts as fallback
        if (accounts && accounts.length > 0) {
          console.log('Using accounts as fallback (rate limited)');
          const accountTokens = accounts.map(account => ({
            id: account.id,
            name: account.name || `Account ${account.id.substring(0, 6)}...`,
            email: account.email || null
          }));
          setUserTokens(accountTokens);
        }
        return;
      }
      
      // Record this fetch attempt
      localStorage.setItem('lastTokenFetch', currentTime.toString());
      
      setLoadingTokens(true);
      
      // Add a small delay to ensure session is properly initialized
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const response = await fetch('/api/user-tokens', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched user tokens:', data.tokens?.length || 0);
        
        // Cache tokens in localStorage
        if (data.tokens && data.tokens.length > 0) {
          localStorage.setItem('cachedUserTokens', JSON.stringify(data.tokens));
        }
        
        setUserTokens(data.tokens || []);
      } else {
        // If the first attempt fails, try again with a delay, but only once
        console.warn('Failed to fetch user tokens on first attempt, retrying once...');
        
        // Wait a moment before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const retryResponse = await fetch('/api/user-tokens', {
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (retryResponse.ok) {
            const data = await retryResponse.json();
            console.log('Fetched user tokens on retry:', data.tokens?.length || 0);
            
            // Cache tokens in localStorage
            if (data.tokens && data.tokens.length > 0) {
              localStorage.setItem('cachedUserTokens', JSON.stringify(data.tokens));
            }
            
            setUserTokens(data.tokens || []);
          } else {
            console.error('Failed to fetch user tokens after retry');
            // Even on error, set empty array to avoid undefined errors elsewhere
            setUserTokens([]);
            
            // Fall back to using accounts from other sources
            if (accounts && accounts.length > 0) {
              console.log('Using accounts from context as fallback for tokens');
              // Use accounts data as a replacement for tokens
              const accountTokens = accounts.map(account => ({
                id: account.id,
                name: account.name || `Account ${account.id.substring(0, 6)}...`,
                email: account.email || null
              }));
              setUserTokens(accountTokens);
            }
          }
        } catch (retryError) {
          console.error('Error during retry attempt:', retryError);
          // Set empty array but try to use accounts as fallback
          setUserTokens([]);
          
          if (accounts && accounts.length > 0) {
            console.log('Using accounts from context as fallback after retry error');
            const accountTokens = accounts.map(account => ({
              id: account.id,
              name: account.name || `Account ${account.id.substring(0, 6)}...`,
              email: account.email || null
            }));
            setUserTokens(accountTokens);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user tokens:', error);
      // Set empty array to avoid undefined errors elsewhere
      setUserTokens([]);
      
      // Try to use accounts as fallback
      if (accounts && accounts.length > 0) {
        console.log('Using accounts from context as fallback after error');
        const accountTokens = accounts.map(account => ({
          id: account.id,
          name: account.name || `Account ${account.id.substring(0, 6)}...`,
          email: account.email || null
        }));
        setUserTokens(accountTokens);
      }
    } finally {
      setLoadingTokens(false);
    }
  }, [accounts]);
  
  // Debounced version of fetchUserTokens
  const debouncedFetchUserTokens = useCallback(() => {
    const lastCall = safeLocalStorage.get('lastTokenFetchCall', '0');
    const now = Date.now();
    const minInterval = 2000; // 2 seconds minimum between calls
    
    if (now - parseInt(lastCall) < minInterval) {
      console.log('Debouncing fetchUserTokens call');
      return;
    }
    
    safeLocalStorage.set('lastTokenFetchCall', now.toString());
    fetchUserTokens();
  }, [fetchUserTokens]);
  
  // Fetch tokens on mount - but only once and with rate limiting
  useEffect(() => {
    // Use the safe wrapper for localStorage
    const hasInitialized = safeLocalStorage.get('tokenFetchInitialized');
    
    if (!hasInitialized) {
      safeLocalStorage.set('tokenFetchInitialized', 'true');
      
      // Use the debounced version instead
      debouncedFetchUserTokens();
      
      // Clear the initialization flag after a timeout
      setTimeout(() => {
        safeLocalStorage.set('tokenFetchInitialized', '');
      }, 60000); // 1 minute
    }
    
    // Cleanup function to clear the initialization flag if component unmounts
    return () => {
      safeLocalStorage.set('tokenFetchInitialized', '');
    };
  }, [debouncedFetchUserTokens]);
  
  // Function to check for new videos - placeholder implementation
  const checkNewVideos = useCallback(() => {
    console.log('Checking for new videos (auto-upload feature)');
    // Actual implementation would go here
  }, []);
  
  // Function to switch between accounts
  const switchAccount = useCallback(async (accountId) => {
    try {
      console.log(`Switching to account: ${accountId}`);
      
      // تنظيف ذاكرة التخزين المؤقت
      localStorage.removeItem('driveFolders');
      localStorage.removeItem('driveFoldersTimestamp');
      localStorage.removeItem('lastHomeFolderRefresh');
      localStorage.removeItem('lastDriveFolderCheck');
      localStorage.removeItem('lastTokenFetch');
      localStorage.removeItem('cachedUserTokens');
      localStorage.removeItem('lastDriveRefresh');
      
      // تحديث العلامات في التخزين المحلي
      localStorage.setItem('accountSwitched', 'true');
      localStorage.setItem('accountSwitchedTimestamp', Date.now().toString());
      
      // توجيه المستخدم مباشرة إلى صفحة الحسابات مع معلمة switchTo
      router.push(`/accounts?switchTo=${accountId}`);
      
      return true;
    } catch (error) {
      console.error('Error switching account:', error);
      return false;
    }
  }, [router]);

  // Refresh Drive folders
  const refreshFolders = useCallback(async () => {
    if (foldersLoading) return; // Avoid multiple simultaneous refreshes
    
    // Add rate limiting for folder refreshes
    const lastFolderRefresh = localStorage.getItem('lastHomeFolderRefresh');
    const currentTime = Date.now();
    const minRefreshInterval = 30000; // 30 seconds
    
    if (lastFolderRefresh && (currentTime - parseInt(lastFolderRefresh)) < minRefreshInterval) {
      console.log('Skipping folder refresh - requested too frequently');
      return;
    }
    
    // Set the last refresh time
    localStorage.setItem('lastHomeFolderRefresh', currentTime.toString());
    
    try {
      console.log('Refreshing folders with force refresh...');
      // Reset the API call limiter to allow a fresh API call
      window._lastDriveFoldersApiCall = 0;
      const result = await fetchDriveFolders(true);
      console.log('homepage Drive folders fetched (force refresh):', result);
    } catch (error) {
      console.error('Error refreshing folders:', error);
      // If error persists, try direct Google Drive API call
      try {
        if (session?.accessToken) {
          await fetch('/api/drive-refreshtoken?force=true');
          // Retry folder fetch after token refresh
          await fetchDriveFolders(true);
        }
      } catch (retryError) {
        console.error('Failed to refresh folders after token refresh:', retryError);
      }
    }
  }, [fetchDriveFolders, session, foldersLoading]);
  
  // Refresh Drive files with changes tracking (renamed to avoid conflict)
  const syncDriveChanges = useCallback(async (forceSync = false) => {
    try {
      await fetchDriveFiles(forceSync);
      setLastChecked(new Date());
    } catch (error) {
      console.error('Error syncing drive changes:', error);
    }
  }, [fetchDriveFiles]);
  
  // Get accounts directly from local storage if context fails
  const getAllAccountsAvailable = useCallback(() => {
    if (accounts && accounts.length > 0) {
      return accounts;
    }
    
    // Try to get from localStorage as fallback
    try {
      const storedAccounts = localStorage.getItem('accounts');
      if (storedAccounts) {
        const parsedAccounts = JSON.parse(storedAccounts);
        console.log('Using accounts from localStorage:', parsedAccounts);
        return parsedAccounts;
      }
    } catch (err) {
      console.error('Error parsing accounts from localStorage:', err);
    }
    
    return [];
  }, [accounts]);

  // Return an array of available accounts with drive data
  const accountsFromDrive = useMemo(() => {
    // Start with accounts from context
    let result = [...(accounts || [])];
    
    // If we have no accounts but we have drive data, construct account objects
    if ((!accounts || accounts.length === 0) && Object.keys(drivesInfo).length > 0) {
      result = Object.keys(drivesInfo).map(accountId => ({
        id: accountId,
        name: `Account ${accountId.substring(0, 6)}...`,
        email: 'Unknown email',
        isActive: accountId === activeDriveAccountId
      }));
    }
    
    return result;
  }, [accounts, drivesInfo, activeDriveAccountId]);
  
  // Use this instead of accounts directly in the UI
  const availableAccounts = useMemo(() => {
    const accountsFromStorage = getAllAccountsAvailable();
    if (accountsFromStorage.length > 0) {
      return accountsFromStorage;
    }
    return accountsFromDrive;
  }, [getAllAccountsAvailable, accountsFromDrive]);
  
  // Merge accounts data from all sources
  const mergedAccounts = useMemo(() => {
    // Add a debug log to track account merging
    console.log('Merging accounts - source counts:', {
      userTokens: userTokens?.length || 0,
      availableAccounts: availableAccounts?.length || 0,
      drivesInfo: Object.keys(drivesInfo || {}).length || 0
    });
    
    // Start with accounts from userTokens
    const merged = [...(userTokens || [])];
    
    // Add any accounts from availableAccounts that aren't in userTokens
    if (availableAccounts && availableAccounts.length > 0) {
      availableAccounts.forEach(account => {
        if (!merged.some(a => a.id === account.id)) {
          merged.push(account);
        }
      });
    }
    
    // Add any accounts from drivesInfo that aren't in the merged list
    Object.keys(drivesInfo || {}).forEach(accountId => {
      if (!merged.some(a => a.id === accountId)) {
        merged.push({ 
          id: accountId,
          name: `Account ${accountId.substring(0, 6)}...`
        });
      }
    });
    
    console.log('Merged accounts from all sources:', merged.length);
    
    // Store merged accounts in localStorage for backup
    if (merged.length > 0) {
      try {
        localStorage.setItem('mergedAccounts', JSON.stringify(merged));
      } catch (err) {
        console.error('Error storing merged accounts in localStorage:', err);
      }
    } else {
      // If we have no accounts but we've stored some previously, use those
      try {
        const storedMergedAccounts = localStorage.getItem('mergedAccounts');
        if (storedMergedAccounts) {
          const parsedAccounts = JSON.parse(storedMergedAccounts);
          if (parsedAccounts && parsedAccounts.length > 0) {
            console.log('Using previously stored merged accounts:', parsedAccounts.length);
            return parsedAccounts;
          }
        }
      } catch (err) {
        console.error('Error parsing stored merged accounts:', err);
      }
    }
    
    return merged;
  }, [userTokens, availableAccounts, drivesInfo]);

  // Set initial active drive account when accounts are loaded
  useEffect(() => {
    // Check if we've already initialized the active account recently
    const lastAccountInit = safeLocalStorage.get('lastAccountInit', '0');
    const currentTime = Date.now();
    const minInitInterval = 10000; // 10 seconds
    
    if (lastAccountInit && (currentTime - parseInt(lastAccountInit)) < minInitInterval) {
      console.log('Skipping account initialization - requested too frequently');
      return;
    }
    
    // Only set the active account if we don't have one already
    if (mergedAccounts && mergedAccounts.length > 0 && !activeDriveAccountId) {
      console.log('Setting initial active drive account to:', mergedAccounts[0].id);
      setActiveDriveAccountId(mergedAccounts[0].id);
      
      // Record this initialization time
      safeLocalStorage.set('lastAccountInit', currentTime.toString());
      
      // Pre-load the drive data for the first account, but add throttling
      if (refreshDrive && typeof refreshDrive === 'function') {
        const lastDriveRefresh = safeLocalStorage.get('lastDriveRefresh', '0');
        if (!lastDriveRefresh || (currentTime - parseInt(lastDriveRefresh)) > 30000) {
          safeLocalStorage.set('lastDriveRefresh', currentTime.toString());
          refreshDrive(mergedAccounts[0].id);
        } else {
          console.log('Skipping drive refresh - requested too frequently');
        }
      }
    }
  }, [mergedAccounts, activeDriveAccountId, refreshDrive, safeLocalStorage]);

  // Load drive data when active account changes
  useEffect(() => {
    // Skip if no active account
    if (!activeDriveAccountId) return;
    
    // Add rate limiting
    const lastAccountChange = safeLocalStorage.get('lastAccountChange', '0');
    const currentTime = Date.now();
    const minChangeInterval = 5000; // 5 seconds
    
    if (lastAccountChange && (currentTime - parseInt(lastAccountChange)) < minChangeInterval) {
      console.log('Skipping drive data load - account changed too frequently');
      return;
    }
    
    // Record this change
    safeLocalStorage.set('lastAccountChange', currentTime.toString());
    
    if (refreshDrive && typeof refreshDrive === 'function') {
      console.log('Active drive account changed, loading drive data for:', activeDriveAccountId);
      
      // Check if we already have data for this account
      const hasData = drivesInfo && drivesInfo[activeDriveAccountId] && 
                      drivesInfo[activeDriveAccountId].files && 
                      drivesInfo[activeDriveAccountId].files.length > 0;
      
      // Only refresh if we don't have data or it's been a while
      const lastAccountRefresh = safeLocalStorage.get(`lastRefresh_${activeDriveAccountId}`, '0');
      if (!hasData || !lastAccountRefresh || (currentTime - parseInt(lastAccountRefresh)) > 60000) {
        safeLocalStorage.set(`lastRefresh_${activeDriveAccountId}`, currentTime.toString());
        refreshDrive(activeDriveAccountId);
      } else {
        console.log('Using cached drive data for account:', activeDriveAccountId);
      }
    }
  }, [activeDriveAccountId, refreshDrive, drivesInfo, safeLocalStorage]);

  // Get folders for the currently active drive account
  const currentDriveFolders = useMemo(() => {
    if (!activeDriveAccountId) return [];
    
    // Try to get from MultiDrive context first
    if (drivesInfo[activeDriveAccountId]?.folders) {
      return drivesInfo[activeDriveAccountId].folders;
    }
    
    // Fall back to legacy drive context
    return driveFolders;
    
  }, [activeDriveAccountId, drivesInfo, driveFolders]);

  // Handle drive account tab selection
  const handleDriveAccountSelect = (accountId) => {
    if (accountId === activeDriveAccountId) return;
    
    console.log(`Switching to drive account: ${accountId}`);
    setActiveDriveAccountId(accountId);
    
    // Refresh drive data for this account if needed
    if (!drivesInfo[accountId] && !loadingDrives[accountId]) {
      refreshDrive(accountId);
    }
  };

  // Get account's display name
  const getAccountDisplayName = (account) => {
    if (!account) return 'Unknown';
    return account.email || account.name || `Account ${account.id.substring(0, 6)}...`;
  };

  // Force accounts to be available from context
  useEffect(() => {
    // Try to get accounts directly if not available through context
    if (!accounts || accounts.length === 0) {
      console.log('No accounts from context, trying to fetch directly');
      
      // استخدام متغير محلي لمنع الاستعلامات المتكررة
      if (window._accountsFetchedDirectly) {
        console.log('Already attempted direct fetch, skipping to prevent loop');
        return;
      }
      
      // تعيين العلامة لمنع الطلبات المتكررة
      window._accountsFetchedDirectly = true;
      
      const fetchAccounts = async () => {
        try {
          const res = await fetch('/api/accounts');
          if (res.ok) {
            const data = await res.json();
            if (data && data.accounts && data.accounts.length > 0) {
              console.log('Fetched accounts directly:', data.accounts);
              // تخزين الحسابات في التخزين المحلي للاستخدام المستقبلي
              try {
                localStorage.setItem('accounts', JSON.stringify(data.accounts));
              } catch (storageErr) {
                console.warn('Could not save accounts to localStorage:', storageErr);
              }
            }
          }
        } catch (err) {
          console.error('Error fetching accounts directly:', err);
        }
      };
      
      // استخدام تأخير قبل الاستعلام للسماح للسياق بالتحميل أولاً
      setTimeout(fetchAccounts, 1500);
    }
  }, [accounts]);

  // Set active drive tab when accounts load - تحسين إدارة حالة علامة التبويب النشطة
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      // إذا لم يتم تعيين علامة تبويب نشطة أو كانت القيمة الحالية غير موجودة في الحسابات
      const accountExists = activeDriveTab && accounts.some(acc => acc.id === activeDriveTab);
      if (!accountExists) {
        console.log('Setting active drive tab to first account:', accounts[0].id);
        setActiveDriveTab(accounts[0].id);
      }
    }
  }, [accounts, activeDriveTab]);

  // Log active drive tab changes for debugging
  useEffect(() => {
    console.log('Active drive tab changed to:', activeDriveTab);
    if (activeDriveTab) {
      console.log('Account info for active tab:', accounts?.find(acc => acc.id === activeDriveTab));
    }
  }, [activeDriveTab, accounts]);

  // Debug accounts data - with rate limiting
  useEffect(() => {
    // Add rate limiting for debug info
    const lastDebugLog = localStorage.getItem('lastDebugLog');
    const currentTime = Date.now();
    const minLogInterval = 10000; // 10 seconds
    
    if (lastDebugLog && (currentTime - parseInt(lastDebugLog)) < minLogInterval) {
      return; // Skip debug logging if done recently
    }
    
    // Record this debug log time
    localStorage.setItem('lastDebugLog', currentTime.toString());
    
    const allAccounts = getAllAccountsAvailable();
    console.log('All available accounts:', allAccounts);
    
    if (accounts?.length > 0 || allAccounts.length > 0) {
      console.log('Accounts data in home page:', {
        accountsCount: accounts?.length || 0,
        allAccountsCount: allAccounts.length,
        activeAccountId: activeDriveAccountId,
        accounts: accounts?.map(acc => ({ 
          id: acc.id, 
          email: acc.email,
          name: acc.name
        }))
      });
      
      // تأكد من أن علامة تبويب نشطة محددة دائما
      if (!activeDriveTab && (accounts?.length > 0 || allAccounts.length > 0)) {
        const firstAccount = accounts?.[0] || allAccounts[0];
        if (firstAccount?.id) {
          setActiveDriveTab(firstAccount.id);
        }
      }
    }
  }, [accounts, activeDriveAccountId, getAllAccountsAvailable, activeDriveTab]);

  // Debug Drive files and folders
  useEffect(() => {
    console.log('Drive data in home page:', {
      driveFilesCount: driveFiles?.length || 0,
      driveFoldersCount: driveFolders?.length || 0,
      selectedFolderId: selectedFolder?.id,
      isLoading: foldersLoading,
      hasError: !!foldersError,
      error: foldersError
    });
  }, [driveFiles, driveFolders, selectedFolder, foldersLoading, foldersError]);

  // Combined loading and error states
  const loadingCombined = userLoading || foldersLoading || tikTokData.loading;
  const combinedError = userError || foldersError || tikTokData.error;
  
  // Update the error state whenever combined errors change
  useEffect(() => {
    setError(combinedError);
  }, [combinedError]);

  // Handle file selection for scheduling
  const handleScheduleSelect = (file) => {
    if (selectedFiles.some(f => f.id === file.id)) {
      setSelectedFiles(selectedFiles.filter(f => f.id !== file.id));
    } else {
      // Check if there's TikTok data for this file
      const tikTokFileData = tikTokFeatureEnabled ? tikTokData.getTikTokDataForDriveFile(file.id) : null;
      
      // Add TikTok data to the file object if available
      const enhancedFile = tikTokFileData ? {
        ...file,
        tikTokData: tikTokFileData,
        tikTokTitle: tikTokFileData.title,
        tikTokDescription: tikTokFileData.description,
        tikTokHashtags: tikTokFileData.hashtags || []
      } : file;
      
      setSelectedFiles([...selectedFiles, enhancedFile]);
    }
  };

  // Select all files for scheduling
  const selectAllFiles = () => {
    if (selectedFiles.length === driveFiles.length) {
      setSelectedFiles([]);
    } else {
      // Add TikTok data to all files
      const enhancedFiles = driveFiles.map(file => {
        const tikTokFileData = tikTokFeatureEnabled ? tikTokData.getTikTokDataForDriveFile(file.id) : null;
        
        return tikTokFileData ? {
          ...file,
          tikTokData: tikTokFileData,
          tikTokTitle: tikTokFileData.title,
          tikTokDescription: tikTokFileData.description,
          tikTokHashtags: tikTokFileData.hashtags || []
        } : file;
      });
      
      setSelectedFiles([...enhancedFiles]);
    }
  };

  // Handle successful refresh
  const handleRefreshSuccess = () => {
    setAuthExpired(false);
    refreshAll(true);
  };

  // Handle refresh error
  const handleRefreshError = () => {
    signOut({ callbackUrl: '/' });
  };

  // Check if authentication has expired - with actual token validation (debounced)
  useEffect(() => {
    // Only set auth expired if there's an error message about expired authentication
    if (error && typeof error === 'string' && (
      error.includes('Your YouTube authentication has expired') ||
      error.includes('Authentication expired') ||
      error.includes('Invalid Credentials')
    )) {
      // Debounce the validation to prevent excessive API calls
      const timeoutId = setTimeout(() => {
        const validateTokens = async () => {
          try {
            // Try to fetch a small amount of data from Drive or YouTube to verify if tokens work
            const response = await fetch('/api/auth/debug');
            const data = await response.json();
            
            // If we got a valid response with authenticated status, don't show the error
            if (response.ok && data.status === 'authenticated' &&
                data.tokenInfo && data.tokenInfo.isValid) {
              setAuthExpired(false);
              setError(null); // Clear the error message since tokens are actually working
              console.log("Tokens are still valid, ignoring authentication error");
            } else {
              // If validation confirms tokens are invalid, show the error
              setAuthExpired(true);
            }
          } catch (e) {
            // If validation check itself fails, assume tokens are expired
            console.error("Error validating tokens:", e);
            setAuthExpired(true);
          }
        };
        
        validateTokens();
      }, 1000); // Debounce for 1 second
      
      return () => clearTimeout(timeoutId);
    } else {
      setAuthExpired(false);
    }
  }, [error]);

  // Redirect to landing page if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Set up auto-upload interval with ref to avoid recreating
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
  }, [session, autoUploadEnabled]); // Removed checkNewVideos dependency

  // Effect for initial data load when session changes
  useEffect(() => {
    // Ensure we have a session before fetching folders
    if (session && !authExpired) {
      const lastFolderRefresh = parseInt(localStorage.getItem('lastFolderRefresh') || '0', 10);
      const now = Date.now();
      const timeSinceLastRefresh = now - lastFolderRefresh;

      if (driveFolders.length === 0) {
        if (timeSinceLastRefresh > 60000) {
          console.log('Home: No folders found and cache expired, fetching folders with force refresh...');
          refreshFolders();
        } else {
          console.log('Home: No folders found but cache is recent, fetching folders without force...');
          fetchDriveFolders(false);
        }
      } else {
        console.log(`Home: Found ${driveFolders.length} folders already loaded`);
      }
    }
  }, [session, authExpired, refreshFolders, fetchDriveFolders, driveFolders.length]);

  // Filter items based on selected folder (show both files and folders)
  const filteredItems = useMemo(() => {
    if (!driveFiles || driveFiles.length === 0) {
      console.log('No drive items to filter');
      return [];
    }
    
    // If selectedFolder is null, return all items
    if (!selectedFolder) {
      console.log(`Showing all ${driveFiles.length} items`);
      return driveFiles;
    }
    
    // Otherwise filter by selected folder
    console.log(`Filtering items by folder: ${selectedFolder.id}`);
    const filtered = driveFiles.filter(item => item.parents && item.parents.includes(selectedFolder.id));
    console.log(`Found ${filtered.length} items in folder ${selectedFolder.id}`);
    return filtered;
  }, [driveFiles, selectedFolder]);

  // Add some debug logging for folder selection
  useEffect(() => {
    console.log('Selected folder changed:', selectedFolder);
    console.log('Filtered items count:', filteredItems.length);
  }, [selectedFolder, filteredItems.length]);

  // Handle folder selection
  const handleFolderSelect = async (e) => {
    const folderId = e.target.value;
    console.log(`Folder selected: ${folderId}`);
    
    if (folderId === 'all') {
      console.log('Showing all files from all folders');
      // Use clearSelectedFolder function from the Drive context
      clearSelectedFolder();
    } else {
      // Find folder in currentDriveFolders first, then fall back to driveFolders
      const folder = currentDriveFolders.find(f => f.id === folderId) || 
                    driveFolders.find(f => f.id === folderId);
      
      if (folder) {
        console.log(`Found folder: ${folder.name} (${folder.id})`);
        // Use selectFolder function from the Drive context
        selectFolder(folder);
      } else {
        console.error(`Folder with ID ${folderId} not found in folders list`);
      }
    }
  };

  // Add additional debugging
  useEffect(() => {
    console.log('Accounts data:', {
      accounts: accounts?.length || 0,
      availableAccounts: availableAccounts?.length || 0,
      mergedAccounts: mergedAccounts?.length || 0,
      drivesInfo: Object.keys(drivesInfo).length || 0,
      activeDriveAccountId
    });
    
    // Try to automatically select first account if none selected
    // Use mergedAccounts as it combines all sources
    if (!activeDriveAccountId && mergedAccounts && mergedAccounts.length > 0) {
      console.log('Auto-selecting first account from mergedAccounts:', mergedAccounts[0].id);
      setActiveDriveAccountId(mergedAccounts[0].id);
    }
    
    // Pre-fetch drive data for all accounts
    if (mergedAccounts && mergedAccounts.length > 0 && refreshAllDrives && typeof refreshAllDrives === 'function') {
      console.log('Pre-fetching drive data for all merged accounts');
      refreshAllDrives();
    }
  }, [accounts, availableAccounts, mergedAccounts, drivesInfo, activeDriveAccountId, refreshAllDrives]);

  // Show loading spinner while checking authentication
  if (userLoading || initialLoading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center dark:bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400"></div>
      </div>
    );
  }

  // Next, check for account availability issues
  // Force noAccounts to false to prevent the message from showing
  const noAccounts = false; // Changed from (!accounts || accounts.length === 0)
  
  // Show user-friendly message if no accounts exist
  if (noAccounts) {
    return (
      <div className="min-h-screen p-8 flex flex-col items-center justify-center text-center dark:bg-black dark:text-white">
        <AppLogoIcon size={64} className="mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No Connected Accounts</h2>
        <p className="mb-4 text-gray-600 dark:text-gray-400">
          Please add a Google Drive account to start uploading and managing your videos.
        </p>
        <button
          onClick={() => router.push('/accounts')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out"
        >
          Add New Account
        </button>
      </div>
    );
  }
  
  // Show a message if there's a user error
  if (userError) {
     return (
      <div className="min-h-screen p-8 flex flex-col items-center justify-center text-center dark:bg-black dark:text-white">
        <AppLogoIcon size={64} className="mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Account Issue</h2>
        <p className="mb-4 text-gray-600 dark:text-gray-400">
          {`Error: ${userError}`}
        </p>
        <button
          onClick={() => router.push('/accounts')}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out"
        >
          Go to Accounts
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 flex flex-col dark:bg-black transition-colors duration-300">
      {/* Auto refresh the token when YouTube auth has expired */}
      {authExpired && <AutoRefresh onSuccess={handleRefreshSuccess} onError={handleRefreshError} />}
      
      {/* Remove the duplicated navbar */}

      {/* Scrollable content area */}
      <div className="mt-4 pb-16">
      <ClientOnly>
        <div className="flex flex-col gap-8 ">
          {/* YouTube Connection Status */}
          <YouTubeConnectionStatus onRefreshSuccess={handleRefreshSuccess} />
          
          {/* Drive Files and Upload Sections */}
          <div className="bg-white dark:bg-black rounded-lg shadow-md p-6 border dark:border-amber-700/30 transition-all duration-300">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold dark:text-amber-50">Manage Content</h2>
                <button
                  onClick={() => {
                    // Reset API call limiters to allow refresh
                    window._lastDriveFoldersApiCall = 0;
                    localStorage.setItem('lastHomeFolderFetch', '0');
                    localStorage.setItem('lastHomeFolderRefresh', '0');
                    
                    syncDriveChanges(true);
                    fetchDriveFolders(true);
                  }}
                  disabled={loadingCombined}
                  className="p-2 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40 border border-blue-200 dark:border-amber-700/30 rounded-full transition-all duration-300"
                  title="Sync with Drive Changes"
                >
                  <FaSync className={foldersLoading ? 'animate-spin' : ''} />
                </button>
            </div>
            
            {/* Account tabs */}
            {accounts && accounts.length > 0 && (
              <div className="mb-4 border-b border-amber-200 dark:border-amber-800/30">
                <div className="flex overflow-x-auto">
                  {accounts.map(account => (
                    <button
                      key={account.id}
                      onClick={() => {
                        if (account.id !== activeDriveAccountId) {
                          console.log(`Tab click: switching to account ${account.id}`);
                          
                          // تنظيف ذاكرة التخزين المؤقت أولاً
                          localStorage.removeItem('driveFolders');
                          localStorage.removeItem('driveFoldersTimestamp');
                          localStorage.removeItem('lastHomeFolderRefresh');
                          localStorage.removeItem('lastDriveFolderCheck');
                          localStorage.removeItem('lastTokenFetch');
                          localStorage.removeItem('cachedUserTokens');
                          localStorage.removeItem('lastDriveRefresh');
                          
                          // محاولة تبديل الحساب مباشرة
                          switchAccount(account.id).then((success) => {
                            if (success) {
                              console.log('Account switched directly, reloading page...');
                              // إعادة تحميل الصفحة بعد تأخير قصير
                              setTimeout(() => {
                                window.location.reload();
                              }, 500);
                            } else {
                              // إذا فشل التبديل المباشر، ننتقل إلى صفحة الحسابات
                              console.log('Redirecting to accounts page to switch account');
                              router.push(`/accounts?switchTo=${account.id}`);
                            }
                          });
                        }
                      }}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        account.id === activeDriveAccountId 
                          ? 'border-amber-500 text-amber-600 dark:text-amber-400' 
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {account.image ? (
                          <div className="w-6 h-6 rounded-full overflow-hidden">
                            <Image 
                              src={account.image} 
                              alt={account.name || 'User'}
                              width={24}
                              height={24}
                              className="w-full h-full object-cover" 
                            />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center">
                            <span className="text-xs font-bold">
                              {account.name ? account.name.charAt(0).toUpperCase() : 'U'}
                            </span>
                          </div>
                        )}
                        <span>{account.name || account.email || 'Account'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Last sync info */}
            {lastChecked && (
              <p className="text-xs text-gray-500 dark:text-amber-400/60 mb-4 text-right">
                Last synced: {new Date(lastChecked).toLocaleTimeString()}
              </p>
            )}
            
            {/* Content tabs - only show Schedule Uploads tab */}
            <div className="flex border-b border-amber-200 dark:border-amber-800/30 mb-4">
              <button
                className="px-4 py-2.5 border-b-2 font-medium transition-colors border-amber-500 text-amber-600 dark:text-amber-400"
              >
                <span className="flex items-center gap-2">
                  <FaCalendarAlt className="text-amber-500" />
                  Schedule Uploads
                </span>
              </button>
            </div>
            
            {/* Full width layout */}
            <div className="w-full">
              {/* Drive accounts tabs inside Schedule Uploads */}
              {availableAccounts && availableAccounts.length > 0 ? (
                <div className="mb-4 border-b border-amber-200 dark:border-amber-800/30">
                  <div className="flex overflow-x-auto">
                    {availableAccounts.map(account => (
                      <button
                        key={account.id}
                        onClick={() => {
                          console.log('Account tab clicked:', account.id);
                          setActiveDriveTab(account.id);
                          
                          // إذا كان الحساب مختلفًا عن الحساب النشط، ننتقل إلى صفحة الحسابات للتبديل
                          if (account.id !== activeDriveAccountId) {
                            console.log('Selected different account than active account');
                            
                            // تنظيف ذاكرة التخزين المؤقت أولاً
                            localStorage.removeItem('driveFolders');
                            localStorage.removeItem('driveFoldersTimestamp');
                            localStorage.removeItem('lastHomeFolderRefresh');
                            localStorage.removeItem('lastDriveFolderCheck');
                            localStorage.removeItem('lastTokenFetch');
                            localStorage.removeItem('cachedUserTokens');
                            localStorage.removeItem('lastDriveRefresh');
                            
                            // محاولة تبديل الحساب مباشرة
                            switchAccount(account.id).then((success) => {
                              if (success) {
                                console.log('Account switched directly, reloading page...');
                                // إعادة تحميل الصفحة بعد تأخير قصير
                                setTimeout(() => {
                                  window.location.reload();
                                }, 500);
                              } else {
                                // إذا فشل التبديل المباشر، ننتقل إلى صفحة الحسابات
                                console.log('Redirecting to accounts page to switch account');
                                router.push(`/accounts?switchTo=${account.id}`);
                              }
                            });
                          } else {
                            // إذا كان هذا هو الحساب النشط، قم بتحديث بيانات Drive له
                            console.log('Refreshing Drive data for active account');
                            syncDriveChanges(true);
                            fetchDriveFolders(true);
                          }
                        }}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                          activeDriveTab === account.id 
                            ? 'border-amber-500 text-amber-600 dark:text-amber-400' 
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {account.image ? (
                            <div className="w-6 h-6 rounded-full overflow-hidden">
                              <Image 
                                src={account.image} 
                                alt={account.name || 'User'}
                                width={24}
                                height={24}
                                className="w-full h-full object-cover" 
                              />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center">
                              <span className="text-xs font-bold">
                                {account.name ? account.name.charAt(0).toUpperCase() : 'U'}
                              </span>
                            </div>
                          )}
                          <div className={`${!account?.email ? 'account-incomplete' : ''}`}>
                            <h3 className="font-medium dark:text-amber-50">
                              {account?.name || 'Google Account'}
                            </h3>
                            <p className={`text-sm ${!account?.email ? 'account-email-placeholder' : 'text-gray-600 dark:text-amber-200/70'}`}>
                              {account?.email || `Email not available (ID: ${account?.id?.substring(0, 8)}...)`}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                  <p className="text-amber-800 dark:text-amber-200">
                    {loadingCombined || loadingTokens ? 
                      'Loading account data...' : 
                      (mergedAccounts.length > 0 ? 
                        `Found ${mergedAccounts.length} accounts. Please select an account to view its Drive content.` :
                        'No accounts available. Please add an account.')
                  }
                  </p>
                  <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    <p>Debug info: Available accounts: {JSON.stringify(availableAccounts?.map(a => ({id: a.id})) || [])}</p>
                    <p>User tokens: {JSON.stringify(userTokens?.map(t => ({id: t.id})) || [])}</p>
                    <p>Merged accounts: {JSON.stringify(mergedAccounts?.map(a => ({id: a.id})) || [])}</p>
                    <p>Active account ID: {activeDriveAccountId || 'none'}</p>
                    <p>Account Context: {JSON.stringify(accounts?.map(a => ({id: a.id})) || [])}</p>
                  </div>
                  <button
                    onClick={() => router.push('/accounts')}
                    className="mt-2 px-3 py-1.5 text-sm rounded-md bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Go to Accounts
                  </button>
                </div>
              )}

              {/* Show content for selected drive account */}
              {activeDriveAccountId ? (
                <>
                  {/* Drive account info */}
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800/30">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        {(() => {
                          // Try to find the account in available accounts
                          const account = availableAccounts?.find?.(acc => acc.id === activeDriveAccountId) || 
                                         accounts?.find?.(acc => acc.id === activeDriveAccountId) || 
                                         { id: activeDriveAccountId };
                          return (
                            <>
                              {account?.image ? (
                                <div className="w-10 h-10 rounded-full overflow-hidden">
                                  <Image 
                                    src={account.image} 
                                    alt={account.name || 'User'}
                                    width={40}
                                    height={40}
                                    className="w-full h-full object-cover" 
                                  />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center">
                                  <span className="text-sm font-bold">
                                    {account?.name ? account.name.charAt(0).toUpperCase() : 'U'}
                                  </span>
                                </div>
                              )}
                              <div className={`${!account?.email ? 'account-incomplete' : ''}`}>
                                <h3 className="font-medium dark:text-amber-50">
                                  {account?.name || 'Google Account'}
                                </h3>
                                <p className={`text-sm ${!account?.email ? 'account-email-placeholder' : 'text-gray-600 dark:text-amber-200/70'}`}>
                                  {account?.email || `Email not available (ID: ${account?.id?.substring(0, 8)}...)`}
                                </p>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      
                      {/* Add refresh button */}
                      <button
                        onClick={() => {
                          console.log('Refreshing Drive data for selected account');
                          refreshDrive(activeDriveAccountId);
                        }}
                        className="p-2 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40 border border-blue-200 dark:border-amber-700/30 rounded-full transition-all duration-300"
                      >
                        <FaSync className={loadingDrives[activeDriveAccountId] ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>

                  {/* Show error message if there's an issue with Drive */}
                  {driveErrors[activeDriveAccountId] && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800/30">
                      <div className="flex items-start gap-2">
                        <div className="text-red-600 dark:text-red-400 mt-0.5">
                          <FaExclamationTriangle />
                        </div>
                        <div>
                          <h4 className="font-medium text-red-700 dark:text-red-400">Drive Error</h4>
                          <p className="text-sm text-red-600 dark:text-red-300">
                            {typeof driveErrors[activeDriveAccountId] === 'string' ? driveErrors[activeDriveAccountId] : 'Error loading Drive data. Try refreshing or signing in again.'}
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => refreshDrive(activeDriveAccountId)}
                              className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded"
                            >
                              Retry
                            </button>
                            <button
                              onClick={() => router.push('/accounts')}
                              className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded"
                            >
                              Go to Accounts
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Show loading indicator when folders are loading */}
                  {loadingDrives[activeDriveAccountId] && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800/30 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600 dark:border-blue-400"></div>
                        <p className="text-blue-700 dark:text-blue-400">Loading Drive data...</p>
                      </div>
                    </div>
                  )}

                  {/* Drive Files Column - full width */}
                  <div className="w-full mb-6">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-medium text-black dark:text-amber-50">Your Drive Videos</h3>
                      {driveFiles.length > 0 && (
                        <button 
                          onClick={selectAllFiles}
                          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-black/60 dark:hover:bg-black/80 text-black dark:text-amber-200/70 rounded border border-amber-200 dark:border-amber-700/30"
                        >
                          {selectedFiles.length === driveFiles.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>

                    {/* Add folder filter dropdown */}
                    <div className="mb-3 w-full">
                      <select
                        value={selectedFolder ? selectedFolder.id : 'all'} 
                        onChange={handleFolderSelect}
                        className="w-full p-2 text-sm border border-amber-200 dark:border-amber-700/30 rounded-lg bg-white dark:bg-black text-black dark:text-amber-50"
                      >
                        <option value="all">All Folders</option>
                        {driveFolders.map(folder => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* قائمة الفيديوهات بشكل شبكة */}
                    <div className="overflow-y-auto max-h-[500px] w-full rounded-lg bg-white/50 dark:bg-black shadow-inner border border-amber-200 dark:border-amber-700/20 transition-all duration-300">
                      {driveFiles.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-3">
                          {filteredItems.map((file) => (
                            <div
                              key={file.id}
                              className={`w-full h-full transition-all duration-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/20 p-3 rounded-lg border ${
                                selectedFiles.some(f => f.id === file.id)
                                ? 'border-amber-500 bg-amber-50/30 dark:bg-amber-900/20'
                                : 'border-transparent'
                              }`}
                              onClick={() => handleScheduleSelect(file)}
                            >
                              <div className="flex flex-col h-full">
                                <div className="absolute top-2 left-2">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedFiles.some(f => f.id === file.id)}
                                    onChange={() => handleScheduleSelect(file)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 text-amber-600"
                                  />
                                </div>
                                <FileListItem 
                                  file={file}
                                  onSchedule={() => handleScheduleSelect(file)}
                                  className="w-full h-full"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                          {loadingCombined ? (
                            <div className="flex justify-center">
                              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-amber-500"></div>
                            </div>
                          ) : (
                            <p>No videos found in your Drive</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Upload Form - full width */}
                  <div className="w-full">
                    {selectedFiles.length > 0 ? (
                      <ScheduleUploadForm
                        multipleFiles={selectedFiles}
                        onScheduled={() => {
                          setSelectedFiles([]);
                        }}
                        onCancel={() => {
                          setSelectedFiles([]);
                        }}
                        onFileRemove={(fileId) => {
                          setSelectedFiles(prev => prev.filter(file => file.id !== fileId));
                        }}
                      />
                    ) : (
                      <>
                        <h3 className="text-lg font-medium text-black dark:text-amber-50 mb-3">Schedule Selected Videos</h3>
                        <p className="text-black dark:text-amber-200/60">
                          Select videos from the list to schedule them for upload.
                        </p>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 text-center bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                  <p className="text-amber-800 dark:text-amber-200">
                    {loadingCombined || loadingTokens ? 
                      'Loading account data...' : 
                      (mergedAccounts.length > 0 ? 
                        `Found ${mergedAccounts.length} accounts. Please select an account to view its Drive content.` :
                        'No accounts available. Please add an account.')
                  }
                  </p>
                  <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    <p>Debug info: Available accounts: {JSON.stringify(availableAccounts?.map(a => ({id: a.id})) || [])}</p>
                    <p>User tokens: {JSON.stringify(userTokens?.map(t => ({id: t.id})) || [])}</p>
                    <p>Merged accounts: {JSON.stringify(mergedAccounts?.map(a => ({id: a.id})) || [])}</p>
                    <p>Active account ID: {activeDriveAccountId || 'none'}</p>
                    <p>Account Context: {JSON.stringify(accounts?.map(a => ({id: a.id})) || [])}</p>
                  </div>
                  <button
                    onClick={() => router.push('/accounts')}
                    className="mt-2 px-3 py-1.5 text-sm rounded-md bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Go to Accounts
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </ClientOnly>
      </div>
    </div>
  );
}