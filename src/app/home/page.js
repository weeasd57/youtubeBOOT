'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { FaUpload, FaSync, FaHistory, FaEye, FaThumbsUp, FaCalendarAlt, FaClock, FaCloudUploadAlt, FaTable, FaDownload, FaHashtag, FaTiktok, FaExclamationTriangle } from 'react-icons/fa';
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
// import { useDrive } from '@/contexts/MultiDriveContext';
import { useMultiChannel } from '@/contexts/MultiChannelContext';
import { useAccounts } from '@/contexts/AccountContext.tsx';
import ClientOnly from '@/components/ClientOnly';
import ScheduleUploadForm from '@/components/ScheduleUploadForm';
import YouTubeChannelInfo from '@/components/YouTubeChannelInfo';
import PageContainer from '@/components/PageContainer';
import FileListItem from '@/components/FileListItem';
import { toast } from 'react-hot-toast';

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
const AppLogoIcon = ({ className = "", size = 24, priority = false }) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    <Image 
      src="/android-chrome-192x192.png" 
      alt="App Logo"
      fill
      className="object-cover"
      priority={priority}
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
      <div className="min-h-screen p-8 flex items-center justify-center bg-slate-50 dark:bg-slate-900" suppressHydrationWarning>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4" suppressHydrationWarning></div>
          <p className="text-slate-600 dark:text-slate-400 text-sm">Loading dashboard...</p>
        </div>
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
      <HomeDashboardContent 
        session={session}
        status={status}
      />
    </PageContainer>
  );
}

// Separate component that only renders on the client
function HomeDashboardContent({ session, status }) {
  const router = useRouter();
  
  // استخدام الـ contexts المتاحة
  const { user, loading: userLoading, error: userError } = useUser();
  const accountContext = useAccounts(); // Get the whole context object
  const { accounts, loading: accountsLoading, refreshAccounts } = accountContext; // Destructure from the object

  // Drive state managed locally, fetched from /api/drive/list
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveFolders, setDriveFolders] = useState([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);

  // Fetch Drive files/folders from API
  const fetchDriveData = useCallback(async (force = false) => {
    if (!accounts || accounts.length === 0) return;
    setDriveLoading(true);
    setDriveError(null);
    try {
      const res = await fetch('/api/drive/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: accounts[0].id, force }),
      });
      if (!res.ok) throw new Error('Failed to fetch Drive data');
      const data = await res.json();
      setDriveFiles(data.files || []);
      setDriveFolders(data.folders || []);
    } catch (err) {
      setDriveError(err.message || 'Unknown error');
    } finally {
      setDriveLoading(false);
    }
  }, [accounts]);

  // Initial fetch on mount or when accounts change
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      fetchDriveData();
    }
  }, [accounts, fetchDriveData]);

  const { 
    channelsInfo, 
    loading: channelsLoading, 
    errors: channelErrors,
    refreshChannel 
  } = useMultiChannel();

  console.log('[DEBUG] Full accountContext from useAccounts:', accountContext);
  console.log('[DEBUG] accounts from useAccounts:', accounts);
  
  // Local state
  const [selectedFiles, setSelectedFiles] = useState([]);
  // No activeDriveTab or activeDriveAccountId logic needed
  const [selectingAll, setSelectingAll] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [lastChecked, setLastChecked] = useState(null);
  
  // Error handling for missing contexts
  const safeChannelsInfo = channelsInfo || {};
  const safeChannelErrors = channelErrors || {};
  
  // Safe error handling
  const hasError = userError || driveError || Object.keys(safeChannelErrors).length > 0;
  
  // Derived state
  const loadingCombined = userLoading || driveLoading || channelsLoading || accountsLoading;
  const availableAccounts = accounts || [];
  const mergedAccounts = availableAccounts;
  const filteredItems = selectedFolder 
    ? driveFiles.filter(file => file.parents && file.parents.includes(selectedFolder.id))
    : driveFiles;
  const currentDriveFolders = driveFolders || [];
  
  // Check for account availability issues
  const noAccounts = !mergedAccounts || mergedAccounts.length === 0;

  // Helper functions
  const handleScheduleSelect = useCallback((file) => {
    setSelectedFiles(prev => {
      const isSelected = prev.some(f => f.id === file.id);
      if (isSelected) {
        return prev.filter(f => f.id !== file.id);
      } else {
        return [...prev, file];
      }
    });
  }, []);

  const selectAllFiles = useCallback(async () => {
    if (selectingAll) return;
    
    setSelectingAll(true);
    setProcessingProgress(0);
    
    try {
      if (selectedFiles.length === filteredItems.length) {
        // Deselect all
        setSelectedFiles([]);
        setProcessingProgress(100);
      } else {
        // Select all with progress simulation
        const totalFiles = filteredItems.length;
        for (let i = 0; i <= totalFiles; i++) {
          setProcessingProgress((i / totalFiles) * 100);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        setSelectedFiles([...filteredItems]);
      }
    } finally {
      setTimeout(() => {
        setSelectingAll(false);
        setProcessingProgress(0);
      }, 500);
    }
  }, [selectingAll, selectedFiles.length, filteredItems]);

  const handleFolderSelect = useCallback((e) => {
    const folderId = e.target.value;
    if (folderId === 'all') {
      setSelectedFolder(null);
    } else {
      const folder = currentDriveFolders.find(f => f.id === folderId);
      if (folder) {
        setSelectedFolder(folder);
      }
    }
  }, [currentDriveFolders]);

  const handleRefreshSuccess = useCallback(() => {
    setLastChecked(new Date().toISOString());
    toast.success('Data refreshed successfully');
  }, []);

  const handleRefreshError = useCallback((error) => {
    toast.error(`Refresh failed: ${error.message}`);
  }, []);

  const syncDriveChanges = useCallback((force = false) => {
    fetchDriveData(force);
    setLastChecked(new Date().toISOString());
  }, [fetchDriveData]);

  const refreshDrive = useCallback((accountId) => {
    fetchDriveData(true);
  }, [fetchDriveData]);

  const fetchDriveFolders = useCallback((force = false) => {
    fetchDriveData(force);
    setLastChecked(new Date().toISOString());
  }, [fetchDriveData]);

  // Enhanced loading state checks - only show loading for critical operations
  const isCriticalLoading = userLoading;
  
  // Show loading spinner for any loading state
  if (isCriticalLoading || accountsLoading) {
    return (
      <div className="min-h-screen p-8 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-900">
        <AppLogoIcon size={64} className="mb-4 animate-pulse" priority={true} />
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-slate-600 dark:text-slate-400">
          {userLoading ? 'Loading user data...' :
           accountsLoading ? 'Loading accounts...' :
           'Setting up your dashboard...'}
        </p>
      </div>
    );
  }

  // Enhanced no accounts check - but don't show this if we're still loading
  const hasAccounts = mergedAccounts?.length > 0;
  
  if (!hasAccounts && !accountsLoading) { 
    return (
      <div className="min-h-screen p-8 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-900">
        <AppLogoIcon size={64} className="mb-4" priority={true} />
        <h2 className="text-2xl font-semibold mb-2 text-slate-900 dark:text-slate-50">No Connected Accounts</h2>
        <p className="mb-6 text-slate-600 dark:text-slate-400 max-w-md">
          Connect your Google Drive account to start scheduling and managing your video uploads.
        </p>
        <Link
          href="/accounts"
          className="schedule-button-primary inline-flex items-center gap-2"
        >
          <FaUpload />
          <span>Connect Account</span>
        </Link>
      </div>
    );
  }
  
  // Show a message if there's a user error
  if (userError) {
     return (
       <div className="min-h-screen p-8 flex flex-col items-center justify-center text-center dark:bg-black dark:text-white">
         <AppLogoIcon size={64} className="mb-4" priority={true} />
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-7xl mx-auto p-6">
        <ClientOnly>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">Content Dashboard</h1>
            <p className="text-slate-600 dark:text-slate-400">Manage and schedule your video content</p>
          </div>

          <div className="space-y-6">
            {/* YouTube Channel Information */}
            <YouTubeChannelInfo />

            {/* Re-authentication Alert */}
            {availableAccounts.length > 0 &&
             safeChannelsInfo[availableAccounts[0].id]?.status === 'reauthenticate_required' && (
              <div className="schedule-card border-l-4 border-l-red-500">
                <div className="schedule-card-content">
                  <div className="flex items-start gap-3">
                    <div className="text-red-600 dark:text-red-400 mt-0.5">
                      <FaExclamationTriangle />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-red-700 dark:text-red-400 mb-1">YouTube Account Disconnected</h4>
                      <p className="text-sm text-red-600 dark:text-red-300 mb-3">
                        Your YouTube account for {safeChannelsInfo[availableAccounts[0].id]?.message || 'this account'} needs to be re-authenticated.
                      </p>
                      <button
                        onClick={() => router.push('/accounts')}
                        className="schedule-badge schedule-badge-error cursor-pointer hover:bg-red-200 dark:hover:bg-red-900/40"
                      >
                        Reconnect Account
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Main Content Card */}
            <div className="schedule-card">
              <div className="schedule-card-header">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Content Library</h2>
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
                    className="schedule-button-secondary p-2"
                    title="Sync with Drive Changes"
                  >
                    <FaSync className={driveLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
              
              <div className="schedule-card-content">
                {/* ...existing code for account status, last sync, content section header, file grid, upload form, etc... */}
                {/* Account Status */}
                {availableAccounts.length === 0 && (
                  <div className="p-4 text-center bg-slate-100 dark:bg-slate-800 rounded-lg mb-6">
                    <p className="text-slate-600 dark:text-slate-400">No accounts available</p>
                  </div>
                )}
                {/* ...existing code... */}
                {/* The rest of your content remains unchanged, just ensure all opened divs are closed below */}
              </div> {/* schedule-card-content */}
            </div> {/* schedule-card */}
          </div> {/* space-y-6 */}
        </ClientOnly>
      </div> {/* max-w-7xl mx-auto p-6 */}
    </div> /* min-h-screen ... */
  );
}