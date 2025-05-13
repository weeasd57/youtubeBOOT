'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { FaUpload, FaSync, FaHistory, FaEye, FaThumbsUp, FaCalendarAlt, FaClock, FaCloudUploadAlt, FaTable, FaDownload, FaHashtag, FaTiktok } from 'react-icons/fa';
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { useDrive } from '@/contexts/DriveContext';
import { useUpload } from '@/contexts/UploadContext';
import { useYouTube } from '@/contexts/YouTubeContext';
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
  
  // Use our context hooks
  const { user, loading: userLoading, error: userError } = useUser();
  const { 
    driveFiles, 
    driveFolders,
    selectedFile, 
    selectedFolder,
    loading: driveLoading, 
    foldersLoading,
    error: driveError,
    selectFile,
    clearSelectedFile,
    selectFolder,
    clearSelectedFolder,
    fetchDriveFiles,
    fetchDriveFolders
  } = useDrive();
  const {
    title,
    setTitle,
    description,
    setDescription,
    loading: uploadLoading,
    uploadStatus,
    uploadingFileId,
    uploadComplete,
    autoUploadEnabled,
    error: uploadError,
    uploadToYouTube,
    checkNewVideos,
    toggleAutoUpload
  } = useUpload();
  const { 
    videos, 
    loading: youtubeLoading, 
    error: youtubeError,
    isQuotaError,
    fetchVideos
  } = useYouTube();
  
  // حالة لتتبع ما إذا كانت ميزة TikTok متاحة
  const [tikTokFeatureEnabled, setTikTokFeatureEnabled] = useState(false);
  const [tikTokData, setTikTokData] = useState({
    videos: [],
    loading: false,
    error: null,
    getTikTokDataForDriveFile: () => null
  });
  
  // استخدام useTikTokVideos بشكل شرطي
  useEffect(() => {
    // التحقق مما إذا كانت متغيرات Supabase البيئية متوفرة
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      setTikTokFeatureEnabled(true);
    }
  }, []);
  
  // استخدام useTikTokVideos إذا كانت الميزة متاحة
  useEffect(() => {
    if (tikTokFeatureEnabled) {
      try {
        const useTikTokVideosHook = UseTikTokVideosComponent();
        if (useTikTokVideosHook) {
          setTikTokData({
            videos: useTikTokVideosHook.videos || [],
            loading: useTikTokVideosHook.loading || false,
            error: useTikTokVideosHook.error || null,
            getTikTokDataForDriveFile: useTikTokVideosHook.getTikTokDataForDriveFile || (() => null)
          });
        }
      } catch (error) {
        console.error('Error loading TikTok videos hook:', error);
      }
    }
  }, [tikTokFeatureEnabled]);

  // Use our new optimized data fetching hook
  const {
    loading: dataLoading,
    initialLoading,
    error: dataError,
    refreshAll,
    refreshDrive,
    refreshYouTube
  } = useDataFetching();

  // State management
  const [authExpired, setAuthExpired] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  // Combined loading and error states
  const loadingCombined = userLoading || dataLoading || uploadLoading || foldersLoading || tikTokData.loading;
  const combinedError = userError || dataError || uploadError || tikTokData.error;
  
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

  // Check if authentication has expired - with actual token validation
  useEffect(() => {
    // Only set auth expired if there's an error message about expired authentication
    if (error && typeof error === 'string' && (
      error.includes('Your YouTube authentication has expired') || 
      error.includes('Authentication expired') ||
      error.includes('Invalid Credentials')
    )) {
      // First, check if APIs are actually responding properly despite the error
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

  // Set up auto-upload interval
  useEffect(() => {
    let interval;
    if (session && autoUploadEnabled) {
      interval = setInterval(() => {
        checkNewVideos();
      }, 5 * 60 * 1000); // Check every 5 minutes
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session, autoUploadEnabled, checkNewVideos]);

  // Refresh Drive files with changes tracking (renamed to avoid conflict)
  const syncDriveChanges = useCallback(async (forceSync = false) => {
    // Use the driveLoading state directly instead of the undefined setLoadingCombined
    try {
      await fetchDriveFiles(forceSync);
      setLastChecked(new Date());
    } catch (error) {
      console.error('Error syncing drive changes:', error);
    }
  }, [fetchDriveFiles]);

  // Refresh Drive folders
  const refreshFolders = useCallback(async () => {
    if (foldersLoading) return; // Avoid multiple simultaneous refreshes
    
    try {
      await fetchDriveFolders(true);
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

  // Effect for initial data load when session changes
  useEffect(() => {
    if (status === 'authenticated' && !foldersLoading && driveFolders.length === 0) {
      // Only fetch folders when component mounts and we don't have any folders yet
      fetchDriveFolders(true);
    }
  }, [status, fetchDriveFolders, foldersLoading, driveFolders.length]);

  // Handle folder selection
  const handleFolderSelect = async (e) => {
    const folderId = e.target.value;
    console.log(`Folder selected: ${folderId}`);
    
    if (folderId === 'all') {
      console.log('Showing all files from all folders');
      // Use clearSelectedFolder function from the Drive context
      clearSelectedFolder();
    } else {
      const folder = driveFolders.find(f => f.id === folderId);
      if (folder) {
        console.log(`Found folder: ${folder.name} (${folder.id})`);
        // Use selectFolder function from the Drive context
        selectFolder(folder);
      } else {
        console.error(`Folder with ID ${folderId} not found in driveFolders list`);
      }
    }
  };

  // Filter files based on selected folder
  const filteredFiles = useMemo(() => {
    if (!driveFiles || driveFiles.length === 0) {
      console.log('No drive files to filter');
      return [];
    }
    
    // إستبعاد المجلدات من القائمة أولاً
    const videoFiles = driveFiles.filter(file => file.mimeType !== 'application/vnd.google-apps.folder');
    
    // If selectedFolder is null or 'all', return all files (excluding folders)
    if (!selectedFolder) {
      console.log(`Showing all ${videoFiles.length} files because selectedFolder is null`);
      return videoFiles;
    }
    
    // Otherwise filter by selected folder
    console.log(`Filtering ${videoFiles.length} files by folder: ${selectedFolder.id}`);
    const filtered = videoFiles.filter(file => file.parents && file.parents.includes(selectedFolder.id));
    console.log(`Found ${filtered.length} files in folder ${selectedFolder.id}`);
    return filtered;
  }, [driveFiles, selectedFolder]);

  // Add some debug logging for folder selection
  useEffect(() => {
    console.log('Selected folder changed:', selectedFolder);
    console.log('Filtered files count:', filteredFiles.length);
  }, [selectedFolder, filteredFiles.length]);

  // Show loading spinner while checking authentication
  if (status === 'loading' || (status === 'authenticated' && initialLoading && !driveFiles.length)) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center dark:bg-black" suppressHydrationWarning>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" suppressHydrationWarning></div>
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
            </div>
            
            {/* Full width refresh button to sync with Drive changes */}
            <div className="mb-4">
              <button
                onClick={() => {
                  syncDriveChanges(true);
                  fetchDriveFolders(true);
                }}
                disabled={loadingCombined}
                className="w-full px-3 py-2 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40 border border-blue-200 dark:border-amber-700/30 rounded-md transition-all duration-300"
              >
                <FaSync className={driveLoading || foldersLoading ? 'animate-spin' : ''} />
                <span>Sync with Drive Changes</span>
              </button>
              {lastChecked && (
                <p className="text-xs text-gray-500 dark:text-amber-400/60 mt-1 text-center">
                  Last synced: {new Date(lastChecked).toLocaleTimeString()}
                </p>
              )}
            </div>
            
            {/* Tabs for Drive and Upload */}
            <div className="flex border-b border-amber-300 dark:border-gray-700 mb-4">
              <button
                className={`px-4 py-2.5 border-b-2 font-medium transition-colors border-amber-500 text-black dark:text-white`}
              >
                <span className="flex items-center gap-2">
                    <FaCalendarAlt className="text-amber-500" />
                  Schedule Uploads
                </span>
              </button>
            </div>
            
            {/* Full width layout */}
            <div className="w-full">
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
                      {filteredFiles.map((file) => (
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
            </div>
          </div>
        </div>
      </ClientOnly>
      </div>
    </div>
  );
} 