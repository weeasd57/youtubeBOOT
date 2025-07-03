'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { FaUpload, FaSync, FaHistory, FaEye, FaCalendarAlt, FaCloudUploadAlt, FaTable, FaTiktok } from 'react-icons/fa';
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { useAccounts } from '@/contexts/AccountContext.tsx';
import PageContainer from '@/components/PageContainer';
import LoadingFallback from '@/components/LoadingFallback';
import ApiErrorBoundary from '@/components/ApiErrorBoundary';
import { toast } from 'react-hot-toast';
import { post, getUserFriendlyErrorMessage } from '@/utils/apiUtils';

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
  // Call useSession at the top level of the component
  const { data: session, status } = useSession();
  
  // Show loading state while session is loading
  if (status === 'loading') {
    return <LoadingFallback message="Loading session..." showLogo={true} />;
  }
  
  // Return the landing page content directly
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

// Separate component that renders the dashboard content
function HomeDashboardContent({ session, status }) {
  const router = useRouter();
  
  // Use the contexts with error handling
  const { user, loading: userLoading, error: userError } = useUser();
  
  // Safely access account context with fallbacks
  const { accounts = [], loading: accountsLoading = false, refreshAccounts = () => {} } = 
    useAccounts() || {};

  // Local state for drive data
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveFolders, setDriveFolders] = useState([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);

  // Fetch Drive files/folders from API with better error handling
  const fetchDriveData = useCallback(async (force = false) => {
    if (!accounts || accounts.length === 0) return;
    
    setDriveLoading(true);
    setDriveError(null);
    
    try {
      const data = await post(
        '/api/drive/list',
        { accountId: accounts[0].id, force },
        {},
        (data) => {
          // Success handler
          setDriveFiles(data.files || []);
          setDriveFolders(data.folders || []);
        },
        (error) => {
          // Error handler
          const errorMessage = getUserFriendlyErrorMessage(error);
          setDriveError(errorMessage);
          toast.error(`Drive data error: ${errorMessage}`);
        }
      );
    } catch (error) {
      // This will only run if the error wasn't handled in the onError callback
      console.error('Unhandled API error:', error);
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
  
  // Local state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectingAll, setSelectingAll] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [lastChecked, setLastChecked] = useState(null);
  
  // Derived state
  const loadingCombined = userLoading || driveLoading || accountsLoading;
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

  // If not authenticated, show landing page content
  if (status === 'unauthenticated') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
            Welcome to Content Scheduler
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            The smarter way to manage your social media content. Connect multiple accounts, schedule posts, and grow your audience effortlessly.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link 
              href="/api/auth/signin"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Get Started
            </Link>
            <Link 
              href="/about"
              className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="text-blue-600 mb-4">
              <FaCloudUploadAlt size={32} />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Easy Uploads</h2>
            <p className="text-gray-600 dark:text-gray-300">
              Upload videos directly from Google Drive to multiple platforms with just a few clicks.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="text-blue-600 mb-4">
              <FaCalendarAlt size={32} />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Smart Scheduling</h2>
            <p className="text-gray-600 dark:text-gray-300">
              Schedule your content for the perfect time to maximize engagement and reach.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="text-blue-600 mb-4">
              <FaTable size={32} />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Multi-Account Management</h2>
            <p className="text-gray-600 dark:text-gray-300">
              Manage all your social media accounts in one place with our intuitive dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated but still loading accounts, show loading state
  if (accountsLoading) {
    return <LoadingFallback message="Loading accounts..." />;
  }

  // If authenticated but no accounts, show onboarding
  if (noAccounts) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-4 text-center">Connect Your First Account</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">
            To get started, connect your Google account to access your Drive files and YouTube channels.
          </p>
          <div className="flex justify-center">
            <Link 
              href="/accounts"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <FaUpload /> Connect Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Main dashboard content when authenticated with accounts
  return (
    <ApiErrorBoundary
      loading={loadingCombined}
      error={userError}
      onRetry={() => window.location.reload()}
    >
      <div className="space-y-6">
        {/* Dashboard header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                fetchDriveData(true);
                handleRefreshSuccess();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2 text-sm"
              disabled={driveLoading}
            >
              {driveLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <FaSync />
              )}
              Refresh Data
            </button>
            
            <Link
              href="/uploader"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center gap-2 text-sm"
            >
              <FaUpload /> Upload Videos
            </Link>
          </div>
        </div>
        
        {/* Content area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Drive files section */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Drive Files</h2>
              
              <select
                value={selectedFolder ? selectedFolder.id : 'all'}
                onChange={handleFolderSelect}
                className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 text-sm"
              >
                <option value="all">All Files</option>
                {currentDriveFolders.map(folder => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
            </div>
            
            <ApiErrorBoundary
              loading={driveLoading}
              error={driveError}
              onRetry={() => fetchDriveData(true)}
            >
              {driveLoading ? (
                <LoadingFallback message="Loading files..." />
              ) : filteredItems.length > 0 ? (
                <div className="space-y-2">
                  {filteredItems.slice(0, 5).map(file => (
                    <div 
                      key={file.id}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md flex justify-between items-center"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded flex items-center justify-center text-blue-600 dark:text-blue-300">
                          {file.mimeType?.includes('video') ? '🎬' : '📄'}
                        </div>
                        <div className="truncate max-w-[200px] sm:max-w-xs">
                          <p className="font-medium truncate">{file.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(file.modifiedTime).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleScheduleSelect(file)}
                        className={`px-3 py-1 rounded text-sm ${
                          selectedFiles.some(f => f.id === file.id)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {selectedFiles.some(f => f.id === file.id) ? 'Selected' : 'Select'}
                      </button>
                    </div>
                  ))}
                  
                  {filteredItems.length > 5 && (
                    <div className="text-center pt-2">
                      <Link
                        href="/uploader"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        View all {filteredItems.length} files
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                  <p>No files found. Connect your Google Drive to see files here.</p>
                </div>
              )}
            </ApiErrorBoundary>
          </div>
          
          {/* Quick actions panel */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            
            <div className="space-y-3">
              <Link
                href="/uploader"
                className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-650 rounded-md transition-colors"
              >
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded flex items-center justify-center text-blue-600 dark:text-blue-300">
                  <FaUpload />
                </div>
                <div>
                  <p className="font-medium">Upload Videos</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Upload videos from Google Drive
                  </p>
                </div>
              </Link>
              
              <Link
                href="/uploads"
                className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-650 rounded-md transition-colors"
              >
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded flex items-center justify-center text-blue-600 dark:text-blue-300">
                  <FaHistory />
                </div>
                <div>
                  <p className="font-medium">Upload History</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    View your recent uploads
                  </p>
                </div>
              </Link>
              
              <Link
                href="/accounts"
                className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-650 rounded-md transition-colors"
              >
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded flex items-center justify-center text-blue-600 dark:text-blue-300">
                  <FaEye />
                </div>
                <div>
                  <p className="font-medium">Manage Accounts</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Connect and manage your accounts
                  </p>
                </div>
              </Link>
              
              <Link
                href="/tiktok-downloader"
                className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-650 rounded-md transition-colors"
              >
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded flex items-center justify-center text-blue-600 dark:text-blue-300">
                  <FaTiktok />
                </div>
                <div>
                  <p className="font-medium">TikTok Downloader</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Download TikTok videos
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ApiErrorBoundary>
  );
}