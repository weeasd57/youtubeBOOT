'use client';

import { useRef, useState, useEffect } from 'react';
import { FaFileUpload, FaDownload, FaSpinner, FaEye, FaSync, FaPlus, FaFolder, FaExclamationTriangle, FaClock, FaTrash, FaCheckCircle, FaFolderPlus, FaMinus, FaTimes, FaCogs, FaStop, FaVideo } from 'react-icons/fa';
import { useSession } from 'next-auth/react';
import Image from "next/image";
import Link from "next/link";
import { useUser } from '@/contexts/UserContext';
import { useTikTok } from '@/contexts/TikTokContext';
import { resetFileInput, openFileDialog } from '@/utils/fileHelpers';
import ClientOnly from '@/components/ClientOnly';
import Navbar from '@/components/Navbar';
import PageContainer from '@/components/PageContainer';
import { toastHelper } from '@/components/ToastHelper';

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

// Add styles for the shimmer animation and RTL scrolling
const shimmerAnimation = `
  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(200%);
    }
  }
  
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
  
  /* RTL Scrolling styles */
  .rtl-scroll {
    direction: rtl;
    overflow-x: auto;
    padding-bottom: 1rem;
  }
  
  .rtl-scroll > * {
    direction: ltr;
  }
  
  /* Hide scrollbar for Chrome, Safari and Opera */
  .rtl-scroll::-webkit-scrollbar {
    display: none;
  }
  
  /* Hide scrollbar for IE, Edge and Firefox */
  .rtl-scroll {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
  
  /* Folder grid animations */
  .folder-grid-item {
    transition: all 0.2s ease-in-out;
  }
  
  .folder-grid-item:hover {
    transform: translateY(-3px);
  }
  
  .folder-grid-item.selected {
    transform: translateY(-3px);
  }
`;

export default function TikTokDownloader() {
  const [isMounted, setIsMounted] = useState(false);

  // Use useEffect to mark component as mounted
  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);

  // Show loading spinner while mounting
  if (!isMounted) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-blue-500 mx-auto mb-4" size={36} />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return <TikTokDownloaderContent />;
}

// Separate content component that uses context hooks
function TikTokDownloaderContent() {
  const {
    videos,
    jsonData,
    loading,
    setLoading,
    currentVideo,
    progress: contextProgress,
    setProgress,
    saveToDrive,
    setSaveToDrive,
    folderName,
    setFolderName,
    driveFolderId,
    driveFolders,
    loadingFolders,
    setLoadingFolders,
    fetchDriveFolders,
    useExistingFolder,
    getDriveFolderUrl,
    createDriveFolder,
    handleFileUpload: handleFileUploadAction,
    downloadAllVideos,
    downloadSingleVideo,
    setDriveFolderId,
    downloadingAll,
    downloadingVideoIds,
    resetDownloader,
    cancelDownloads,
    concurrentDownloads,
    setConcurrentDownloads,
    lastDownloadedIndex
  } = useTikTok();

  const fileInputRef = useRef(null);
  const { data: session } = useSession();
  const { user } = useUser();
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [foldersError, setFoldersError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showFolderInput, setShowFolderInput] = useState(false);

  const setConcurrencyLevel = (level) => setConcurrentDownloads(level);

  // Load drive folders when component mounts - only once
  useEffect(() => {
    if (session && saveToDrive && !foldersLoaded) {
      loadFolders();
    }
  }, [session, saveToDrive, foldersLoaded]);

  // Load the folders with better error handling
  const loadFolders = async () => {
    // Don't call setLoadingFolders directly since it seems to have issues
    // Instead, rely on fetchDriveFolders to handle the loading state
    setFoldersError(false);
    setErrorMessage('');

    // Add rate limiting to avoid excessive API calls
    const lastFolderLoad = localStorage.getItem('lastTikTokPageFolderLoad');
    const currentTime = Date.now();
    const shouldRefresh = !lastFolderLoad || (currentTime - parseInt(lastFolderLoad)) > 60000; // 1 minute
    
    if (!shouldRefresh && !saveToDrive) {
      console.log('Skipping folder refresh due to rate limiting');
      return;
    }
    
    try {
      console.log('Loading Drive folders...');
      localStorage.setItem('lastTikTokPageFolderLoad', currentTime.toString());
      
      // fetchDriveFolders already handles setting loadingFolders internally
      const result = await fetchDriveFolders({ 
        forceRefresh: false // Use cache when possible
      });

      if (!result.success) {
        setFoldersError(true);

        if (result.error && (result.error.includes('permission') || result.error.includes('Permission'))) {
          setErrorMessage('Your Google account may have insufficient permissions to upload to Drive.');
          return;
        }

        if (result.error && result.error.includes('timed out')) {
          setErrorMessage(`${result.error} Please try again later.`);
        } else if (result.fromCache) {
          if (result.networkError) {
            setErrorMessage('Network connectivity issue. Showing folders from cache. Check your internet connection.');
          } else {
            setErrorMessage('Showing folders from cache. Some folders may be outdated.');
          }
        } else {
          setErrorMessage(result.error || 'Failed to load folders from Google Drive');
        }
      }

      setFoldersLoaded(true);
    } catch (error) {
      console.error('Error in loadFolders:', error);
      setFoldersError(true);
      setErrorMessage(error.message || 'An unexpected error occurred when loading folders');
    }
  };

  // Add helper function to handle folder refresh retry
  const handleRetryFolders = () => {
    console.log('Retrying folder fetch...');
    setFoldersLoaded(false);
    loadFolders();
  };

  // Reset folders loaded flag when saveToDrive changes
  useEffect(() => {
    if (!saveToDrive) {
      setFoldersLoaded(false);
      setFoldersError(false);
      setErrorMessage('');
    }
  }, [saveToDrive]);

  // Handle creating a new folder
  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toastHelper.error('Please enter a folder name');
      return;
    }
    
    setCreatingFolder(true);
    
    try {
      const result = await createDriveFolder(folderName);
      if (result) {
        toastHelper.success(`Folder "${folderName}" created successfully!`);
        
        // Refresh the folder list with force refresh to ensure we see the new folder
        setLoadingFolders(true);
        try {
          // Explicitly set timestamp to force refresh to avoid throttling
          localStorage.setItem('lastTikTokPageFolderLoad', '0');
          window._lastDriveFoldersApiCall = 0; // Reset the API call limiter
          
          const refreshResult = await fetchDriveFolders({ forceRefresh: true });
          
          if (refreshResult && refreshResult.success) {
            setFoldersLoaded(true);
            
            // Show notification about manually selecting the folder
            toastHelper.info('Folder created. You need to select it to save videos to Drive.');
            
            // Hide the folder input form
            setShowFolderInput(false);
          } else {
            console.error('Error refreshing folders after creation:', refreshResult?.error);
          }
        } catch (refreshError) {
          console.error('Error refreshing folders after creation:', refreshError);
        } finally {
          setLoadingFolders(false);
        }
      } else {
        toastHelper.error('Failed to create folder. Please check your connection and try again.');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      toastHelper.error('Failed to create folder: ' + (error.message || 'Unknown error'));
    } finally {
      setCreatingFolder(false);
    }
  };

  // Handle selecting a folder from the grid
  const handleSelectFolder = (folder) => {
    setSelectedFolderId(folder.id);
    setFolderName(folder.name);
    useExistingFolder(folder.id, folder.name);
    setShowFolderInput(false);
  };

  // Toggle new folder input visibility
  const handleShowFolderInput = () => {
    setShowFolderInput(!showFolderInput);
    if (!showFolderInput) {
      // Clear selected folder when showing folder input
      setSelectedFolderId('');
      // Clear the drive folder ID directly instead of calling useExistingFolder
      setDriveFolderId(null);
      
      // Focus on folder name input when shown (in next render)
      setTimeout(() => {
        const inputElement = document.querySelector('input[placeholder="Enter folder name"]');
        if (inputElement) inputElement.focus();
      }, 100);
    }
  };

  // Handle new folder name change
  const handleFolderNameChange = (e) => {
    setFolderName(e.target.value);
    // Reset selected folder when typing a new name
    if (selectedFolderId) {
      setSelectedFolderId('');
    }
  };

  // Handle file input change
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUploadAction(file);
    }
  };

  // Create a new handleFolderChange to work with our grid interface
  const handleFolderChange = (e) => {
    const folderId = e.target.value;
    setSelectedFolderId(folderId);
    setShowFolderInput(false);
    
    if (folderId) {
      const folder = driveFolders.find(f => f.id === folderId);
      if (folder) {
        setFolderName(folder.name);
        useExistingFolder(folder.id, folder.name);
      }
    }
  };

  // Status badge component
  const getStatusBadge = (status, videoProgress = 0, size = null) => {
    // Make sure videoProgress is always a number
    videoProgress = parseInt(videoProgress || 0);
    
    switch (status) {
      case 'pending':
        return (
          <div className="space-y-1">
            <span className="px-3 py-1.5 text-xs bg-gray-700 text-gray-300 dark:bg-gray-700/50 dark:text-gray-300 rounded-full inline-flex items-center gap-1.5 font-medium border border-gray-600 dark:border-gray-600 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></span>
              Pending
            </span>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-gray-400 dark:bg-gray-500 rounded-full" style={{ width: '5%' }}></div>
            </div>
          </div>
        );
      case 'processing':
        return (
          <div className="space-y-1">
            <span className="px-3 py-1.5 text-xs bg-amber-900/40 text-amber-400 dark:bg-amber-900/40 dark:text-amber-400 rounded-full inline-flex items-center gap-1.5 font-medium border border-amber-800 dark:border-amber-800 shadow-sm">
              <FaSpinner className="animate-spin" size={12} />
              Processing
            </span>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 dark:bg-amber-600 rounded-full" style={{ width: '30%' }}></div>
            </div>
          </div>
        );
      case 'downloading':
        return (
          <div className="space-y-1">
            <span className="px-3 py-1.5 text-xs bg-amber-900/40 text-amber-400 dark:bg-amber-900/40 dark:text-amber-400 rounded-full inline-flex items-center gap-1.5 font-medium border border-amber-800 dark:border-amber-800 shadow-sm">
              <FaSpinner className="animate-spin" size={12} />
              Downloading {videoProgress}%
            </span>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 dark:bg-amber-600 rounded-full" 
                style={{ width: `${videoProgress}%` }}>
              </div>
            </div>
          </div>
        );
      case 'completed':
        return (
          <div className="space-y-1">
            <span className="px-3 py-1.5 text-xs bg-green-900/40 text-green-400 dark:bg-green-900/40 dark:text-green-400 rounded-full inline-flex items-center gap-1.5 font-medium border border-green-800 dark:border-green-800 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Completed
            </span>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 dark:bg-green-600 rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>
        );
      case 'failed':
        return (
          <div className="space-y-1">
            <span className="px-3 py-1.5 text-xs bg-red-900/40 text-red-400 dark:bg-red-900/40 dark:text-red-400 rounded-full inline-flex items-center gap-1.5 font-medium border border-red-800 dark:border-red-800 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Failed
            </span>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 dark:bg-red-600 rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };
  
  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === null || bytes === undefined || isNaN(bytes)) {
      return 'Unknown';
    }
    
    // Make sure bytes is a number
    const size = Number(bytes);
    
    if (size === 0) return '0 B';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Add a new formatDuration function to format video duration
  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '--:--';
    
    // تحويل النص إلى رقم إذا كان نصًا
    let duration = Number(seconds);
    
    // معالجة البيانات بالميلي-ثانية (بعض الـ API تعيد الوقت بالميلي-ثانية)
    if (duration > 10000) {
      duration = duration / 1000;
    }
    
    if (duration < 0) {
      return '--:--';
    }
    
    if (duration < 60) {
      return `0:${duration < 10 ? '0' : ''}${Math.floor(duration)}`;
    }
    
    const minutes = Math.floor(duration / 60);
    const remainingSeconds = Math.floor(duration % 60);
    
    if (minutes < 60) {
      return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return `${hours}:${remainingMinutes < 10 ? '0' : ''}${remainingMinutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const isDownloading =
    downloadingAll ||
    loading ||
    videos.some(v => v.status === 'downloading' || v.status === 'processing');

  return (
    <PageContainer user={user}>
      {/* Add custom styles */}
      <style dangerouslySetInnerHTML={{ __html: shimmerAnimation }} />

      <div className="w-full px-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2 dark:text-white">TikTok Batch Downloader</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Upload your TikTok Favorites JSON file and download all videos at once
          </p>

          {/* Documentation section */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">How to use:</h3>
            <ol className="list-decimal pl-5 space-y-2 text-gray-700 dark:text-gray-300">
              <li>Get your TikTok data in JSON format from <a href="https://apify.com/clockworks/free-tiktok-scraper" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Apify.com TikTok Scraper</a> by scraping your TikTok "posts" data</li>
              <li>Click the "Upload JSON File" button below and select your JSON file</li>
              <li>Enable "Save to Google Drive" if you want to store the videos in your Drive</li>
              <li>Select an existing folder or create a new one in your Google Drive</li>
              <li>Click "Download All Videos" to batch download all videos in the JSON file</li>
            </ol>
            <div className="mt-3 text-sm text-amber-600 dark:text-amber-400 flex items-center">
              <FaSync className="mr-2" size={14} />
              Remember to use the "Sync with Drive Changes" feature if videos are missing or you delete files from Drive
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-4 justify-center items-center">
            <button
              onClick={() => openFileDialog(fileInputRef)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md flex items-center gap-2"
            >
              <FaFileUpload /> Upload JSON File
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json"
                className="hidden"
              />
            </button>

            {/* Add Concurrency Settings */}
            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                <FaCogs className="inline mr-1" />
                Concurrent Downloads:
              </div>
              <button 
                onClick={() => setConcurrencyLevel(Math.max(1, concurrentDownloads - 1))}
                className="h-8 w-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-l-md"
                disabled={concurrentDownloads <= 1 || downloadingAll}
              >
                <FaMinus size={12} />
              </button>
              <div className="h-8 w-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-sm font-medium">
                {concurrentDownloads}
              </div>
              <button 
                onClick={() => setConcurrencyLevel(Math.min(10, concurrentDownloads + 1))}
                className="h-8 w-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-r-md"
                disabled={concurrentDownloads >= 10 || downloadingAll}
              >
                <FaPlus size={12} />
              </button>
            </div>
          </div>

          {session && (
            <div className="mb-4 p-4 bg-white dark:bg-black border border-amber-500 dark:border-amber-500 rounded-lg">
              <h3 className="text-lg font-medium mb-3 text-gray-800 dark:text-white">Google Drive Settings</h3>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="saveToDrive"
                    checked={saveToDrive}
                    onChange={(e) => setSaveToDrive(e.target.checked)}
                    className="w-4 h-4 text-amber-500 bg-gray-100 border-gray-300 rounded focus:ring-amber-500 dark:focus:ring-amber-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label htmlFor="saveToDrive" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Save to Google Drive
                  </label>
                </div>
                
                {saveToDrive && (
                  <div className="space-y-4">
                    {/* Option 1: Use existing folder - simplified to just be the title */}
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        Select a folder or create a new one
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            // Set loading state
                            setLoadingFolders(true);
                            setFoldersError(false);
                            
                            try {
                              // Force refresh from API, not cache
                              const result = await fetchDriveFolders({ forceRefresh: true });
                              
                              if (result && result.success) {
                                setFoldersLoaded(true);
                              } else {
                                setFoldersError(true);
                                setErrorMessage(result.error || 'Failed to refresh folders');
                              }
                            } catch (error) {
                              console.error('Error refreshing folders:', error);
                              setFoldersError(true);
                              setErrorMessage(error.message || 'An error occurred while refreshing folders');
                            } finally {
                              setLoadingFolders(false);
                            }
                          }}
                          disabled={loadingFolders}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md flex items-center gap-2 disabled:opacity-50 text-xs"
                          title="Refresh folder list"
                        >
                          {loadingFolders ? (
                            <FaSync className="animate-spin" size={14} />
                          ) : (
                            <FaSync size={14} />
                          )}
                          {loadingFolders ? 'Refreshing...' : 'Refresh Folders'}
                        </button>
                      </div>
                    </div>
                    
                    {/* Show folders error if any */}
                    {foldersError && (
                      <div className="mt-2 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
                        <div className="flex items-start">
                          <FaExclamationTriangle className="text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <p>{errorMessage || 'Failed to load folders from Google Drive'}</p>
                            <button
                              onClick={handleRetryFolders}
                              className="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md flex items-center gap-2 text-xs w-auto"
                            >
                              <FaSync size={14} />
                              Retry Loading Folders
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-2">
                      {loadingFolders && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-2">
                          <FaSync className="animate-spin" size={14} />
                          Loading your Drive folders...
                        </div>
                      )}
                      
                      {!loadingFolders && !foldersError && driveFolders.length === 0 && (
                        <div className="mt-2 p-2 bg-yellow-50 dark:bg-amber-900/20 border border-yellow-200 dark:border-amber-800/30 rounded-md">
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            No folders found in your Google Drive.
                          </p>
                        </div>
                      )}

                      {!loadingFolders && !foldersError && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-2">
                          {/* Create folder card */}
                          <div 
                            className="h-24 border-2 border-dashed border-amber-400 dark:border-amber-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all hover:-translate-y-1 overflow-hidden relative"
                            onClick={handleShowFolderInput}
                          >
                            <div className="flex flex-col items-center">
                              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-2">
                                <FaPlus className="text-amber-500 dark:text-amber-400" size={18} />
                              </div>
                              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Create Folder</span>
                            </div>
                          </div>

                          {/* Display folders in grid */}
                          {driveFolders.map(folder => (
                            <div 
                              key={folder.id} 
                              className={`h-24 border-2 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer transition-all hover:-translate-y-1 overflow-hidden relative ${
                                selectedFolderId === folder.id 
                                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-500 shadow-md' 
                                  : 'border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700'
                              }`}
                              onClick={() => handleSelectFolder(folder)}
                            >
                              <div className={`p-2 rounded-full mb-2 ${
                                selectedFolderId === folder.id 
                                  ? 'bg-amber-100 dark:bg-amber-900/30' 
                                  : 'bg-gray-100 dark:bg-gray-800'
                              }`}>
                                <FaFolder 
                                  className={`${
                                    selectedFolderId === folder.id 
                                      ? 'text-amber-500 dark:text-amber-400' 
                                      : 'text-gray-400 dark:text-gray-500'
                                  }`} 
                                  size={18} 
                                />
                              </div>
                              <span className="text-xs font-medium text-center line-clamp-2 overflow-hidden text-gray-700 dark:text-gray-300">
                                {folder.name}
                              </span>
                              {selectedFolderId === folder.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500"></div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Show folder input only when showFolderInput is true */}
                    {showFolderInput && (
                      <div className="mt-4 p-3 border border-amber-300 dark:border-amber-700 rounded-md bg-amber-50 dark:bg-amber-900/20">
                        <div className="text-sm font-medium mb-2 text-amber-700 dark:text-amber-400">
                          Create a new folder
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={folderName}
                            onChange={handleFolderNameChange}
                            placeholder="Enter folder name"
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 dark:bg-gray-800 dark:text-white"
                          />
                          <button
                            onClick={handleCreateFolder}
                            disabled={loadingFolders || !folderName.trim() || creatingFolder}
                            className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md flex items-center gap-2 disabled:opacity-50"
                          >
                            {creatingFolder ? (
                              <>
                                <FaSpinner className="animate-spin" size={16} />
                                Creating...
                              </>
                            ) : (
                              "Create Folder"
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Load folders section */}
        {session && saveToDrive && (
          <div className="mb-6">
            <div className="mb-2 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-white flex items-center">
                <FaFolder className="mr-2 text-amber-500" /> Google Drive Folders
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleRetryFolders}
                  disabled={loadingFolders}
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-colors"
                >
                  {loadingFolders ? <FaSpinner className="animate-spin" /> : <FaSync />}
                  {loadingFolders ? 'Loading...' : 'Reload Folders'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add folder destination display - تحسين وإزالة الكلام المكرر */}
        {driveFolderId && false ? (
          <div className="mt-4 p-3 bg-white dark:bg-gray-800 border border-amber-500 dark:border-amber-500 rounded-md">
            <div className="flex items-center justify-between py-4 px-3">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Videos will be saved to: <span className="font-bold text-amber-600 dark:text-amber-400">{folderName}</span>
                </p>
              </div>
              <a
                href={getDriveFolderUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md flex items-center gap-2 text-sm"
              >
                <FaEye size={14} /> View Folder
              </a>
            </div>
          </div>
        ) : saveToDrive && !driveFolderId && false ? (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  Please select or create a folder in Google Drive
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Add local download notice when Drive is disabled */}
        {!saveToDrive && false ? (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-md">
            <div className="flex items-center">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  Google Drive saving is disabled
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                  Videos will be downloaded directly to your device
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Current status message - تحسين عرض حالة المجلد المختار */}
        {!showFolderInput && !loadingFolders && !foldersError && (
          <div className="mt-4 p-5 rounded-md bg-opacity-90 dark:bg-opacity-90 bg-slate-800 dark:bg-slate-900 border-2 border-amber-500 dark:border-amber-500 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-md flex items-center">
                <span className="mr-3 w-3 h-3 rounded-full inline-block" style={{ 
                  backgroundColor: selectedFolderId ? '#22c55e' : '#f59e0b' 
                }}></span>
                <span className="font-medium text-white dark:text-white">
                  {selectedFolderId 
                    ? <span>Videos will be saved to: <span className="text-amber-400 dark:text-amber-400 font-bold">{folderName}</span></span>
                    : <span className="text-amber-400 dark:text-amber-400 font-bold">No folder selected - videos will download locally</span>
                  }
                </span>
              </p>
              {driveFolderId && (
                <a
                  href={getDriveFolderUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md flex items-center gap-2 text-sm"
                >
                  <FaEye size={14} /> View Folder
                </a>
              )}
            </div>
          </div>
        )}

        {/* Videos Found in JSON summary section - moved from bottom of page to here */}
        {jsonData ? (
          <div className="space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-800 dark:text-white">
                  {videos.length} Videos Found in JSON
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {videos.filter(v => v.status === 'completed').length} downloaded, 
                  {videos.filter(v => v.status === 'failed').length} failed
                </p>
                {lastDownloadedIndex >= 0 && (
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-500 mt-1">
                    <FaSync className="inline-block mr-1" size={12} />
                    Resume from video #{lastDownloadedIndex + 2}
                  </p>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                {isDownloading ? (
                  <button
                    onClick={cancelDownloads}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center gap-2 font-bold shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 animate-pulse"
                    disabled={!isDownloading}
                  >
                    <FaStop /> Cancel All Downloads
                  </button>
                ) : (
                  <button
                    onClick={downloadAllVideos}
                    disabled={videos.length === 0}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaDownload /> Download All Videos
                  </button>
                )}
                
                <button
                  onClick={resetDownloader}
                  disabled={loading || downloadingAll}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaTrash />
                  Reset
                </button>
              </div>
            </div>

            {loading && (
              <div className="mb-6">
                <div className="mb-2 flex justify-between items-center">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {contextProgress}% Complete
                    {lastDownloadedIndex >= 0 && (
                      <span className="ml-2 text-amber-500 dark:text-amber-400">
                        (Resuming from #{lastDownloadedIndex + 2})
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 dark:bg-amber-600 transition-all duration-300 ease-out relative overflow-hidden"
                    style={{ width: `${contextProgress}%` }}
                  >
                    <div className="absolute inset-0 overflow-hidden">
                      <span className="absolute top-0 bottom-0 w-8 bg-white/30 -skew-x-30 animate-shimmer"></span>
                    </div>
                  </div>
                </div>
                
                {currentVideo && (
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 flex items-center">
                    <FaSpinner className="animate-spin mr-2" />
                    Currently processing: {currentVideo.title || currentVideo.desc || 'Video'} 
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-8 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg mb-6">
            <p className="text-gray-600 dark:text-gray-400">
              Please upload a TikTok JSON file to start downloading videos
            </p>
          </div>
        )}

        {jsonData && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-medium dark:text-white">Found {videos.length} videos</h2>
            </div>

            {videos.length > 0 && (
              <div className="bg-white dark:bg-black rounded-lg shadow-xl p-6 overflow-hidden border border-amber-500 dark:border-amber-500 transition-all hover:shadow-lg">
                <div className="overflow-x-auto rtl-scroll">
                  <table className="w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-black">
                        <th className="px-6 py-4 text-left text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider rounded-tl-lg">Video</th>
                        <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">Link</th>
                        <th className="px-4 py-4 text-left text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider whitespace-nowrap">Duration</th>
                        <th className="px-4 py-4 text-left text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider rounded-tr-lg">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {videos.map((video, index) => {
                        // Extract video metadata
                        const videoDefinition = video.definition || 
                                              (video.videoData && video.videoData.definition) || 
                                              "Standard";
                        
                        // استخراج مدة الفيديو من مختلف الحقول الممكنة في بيانات JSON
                        let videoDuration = null;
                        if (video.duration) {
                          videoDuration = video.duration;
                        } else if (video.videoData && video.videoData.duration) {
                          videoDuration = video.videoData.duration;
                        } else if (video.stats && video.stats.duration) {
                          videoDuration = video.stats.duration;
                        } else if (video.meta && video.meta.duration) {
                          videoDuration = video.meta.duration;
                        } else if (video.videoDuration) {
                          videoDuration = video.videoDuration;
                        } else if (video.video_duration) {
                          videoDuration = video.video_duration;
                        } else if (video.length) {
                          videoDuration = video.length;
                        }
                        
                        return (
                        <tr key={video.id} className={`transition-colors hover:bg-gray-100 dark:hover:bg-gray-900 border-b border-gray-200 dark:border-gray-800 ${
                          lastDownloadedIndex >= 0 && videos.indexOf(video) === lastDownloadedIndex + 1 
                            ? 'border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-900/20' 
                            : ''
                        }`}>
                          <td className="px-6 py-4 text-left">
                            <div className="text-sm font-semibold text-gray-800 dark:text-gray-300">
                              {video.title}
                              {/* Add destination badge */}
                              <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                saveToDrive && driveFolderId
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                              }`}>
                                {saveToDrive && driveFolderId
                                  ? 'Drive'
                                  : 'Local'
                                }
                              </span>
                              
                              {/* Add resume indicator */}
                              {lastDownloadedIndex >= 0 && videos.indexOf(video) === lastDownloadedIndex + 1 && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 animate-pulse">
                                  <FaSync className="mr-1" size={8} />
                                  Resume from here
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="hidden md:table-cell px-6 py-4 text-left">
                            <div className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">{video.url}</div>
                          </td>
                          <td className="px-4 py-4 text-left">
                            <div className="flex flex-col space-y-1">
                              <div className="text-sm font-semibold text-amber-600 dark:text-amber-500 flex items-center">
                                <FaClock className="mr-1" size={12} />
                                {videoDuration ? (
                                  <span className="text-gray-700 dark:text-gray-300">{formatDuration(videoDuration)}</span>
                                ) : (
                                  <span className="text-gray-500 dark:text-gray-400">--:--</span>
                                )}
                              </div>
                              {videoDefinition && (
                                <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                  <FaVideo className="mr-1" size={8} />
                                  {videoDefinition}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-left">
                            {getStatusBadge(video.status, video.progress, video.fileSize)}
                          </td>
                          <td className="px-6 py-4 text-left">
                            <div className="flex flex-col md:flex-row gap-2">
                              <button
                                onClick={() => downloadSingleVideo(video)}
                                disabled={video.status === 'processing' || loading || downloadingAll || downloadingVideoIds.includes(video.id)}
                                className={`px-3 py-1.5 rounded-md flex items-center gap-1 transition-all ${
                                  downloadingVideoIds.includes(video.id) 
                                    ? 'bg-amber-700 text-white' 
                                    : 'bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:text-white hover:scale-105'
                                } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                              >
                                {downloadingVideoIds.includes(video.id) ? (
                                  <>
                                    <FaSpinner size={12} className="animate-spin" />
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <FaDownload size={12} />
                                    {saveToDrive && driveFolderId ? 'Save to Drive' : 'Download'}
                                  </>
                                )}
                              </button>
                              {video.status === 'failed' && (
                                <button
                                  onClick={() => window.open(video.url, '_blank')}
                                  className="px-3 py-1.5 rounded-md flex items-center gap-1 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 hover:scale-105 transition-all"
                                >
                                  <FaEye size={12} />
                                  Open Original
                                </button>
                              )}
                              {video.status === 'completed' && saveToDrive && driveFolderId && (
                                <button
                                  onClick={() => {
                                    window.open(`${getDriveFolderUrl()}?resourcekey=${video.videoId || ''}`, '_blank');
                                  }}
                                  className="px-3 py-1.5 rounded-md flex items-center gap-1 bg-purple-200 hover:bg-purple-300 text-purple-700 dark:bg-purple-700 dark:text-purple-200 dark:hover:bg-purple-600 hover:scale-105 transition-all"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                  </svg>
                                  View in Drive
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {videos.length > 0 && videos.some(video => video.status === 'failed') && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-lg font-medium text-red-800 mb-2">Failed to download some videos</h3>
            <p className="text-red-700 mb-2">This application now only uses direct links from JSON files for downloading:</p>
            <ul className="list-disc list-inside text-red-700 mb-3">
              <li>Make sure your JSON file contains valid direct links in the keys <code className="bg-red-100 px-1">downloadAddr</code> or <code className="bg-red-100 px-1">mediaUrls</code></li>
              <li>Direct links must point directly to video files (mp4) and not web pages</li>
              <li>Ensure that the direct links have not expired (TikTok links expire quickly)</li>
            </ul>
          </div>
        )}

        {/* Add a resume notification when a resume position is detected */}
        {lastDownloadedIndex >= 0 && (
          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-full">
                <FaSync className="text-amber-600 dark:text-amber-400" size={16} />
              </div>
              <div>
                <h3 className="text-md font-medium text-amber-700 dark:text-amber-400 mb-1">
                  Resume Downloads Detected
                </h3>
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  Your previous download session was interrupted at video #{lastDownloadedIndex + 1}.
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-400 mt-1 font-arabic">
                  {/* Arabic explanation */}
                  تم اكتشاف عملية تحميل سابقة لم تكتمل. يمكنك استئناف التحميل من حيث توقفت عن طريق الضغط على زر "استئناف التحميل".
                </p>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-red-100 text-red-700 rounded mb-4">
            {errorMessage}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
