'use client';

import { useRef, useState, useEffect } from 'react';
import { FaFileUpload, FaDownload, FaSpinner, FaEye, FaSync, FaPlus, FaFolder, FaGoogle, FaSyncAlt, FaExclamationTriangle } from 'react-icons/fa';
import { useSession } from 'next-auth/react';
import Image from "next/image";
import Link from "next/link";
import { useUser } from '@/contexts/UserContext';
import { useTikTok } from '@/contexts/TikTokContext';
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
    currentVideo,
    progress,
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

  // Load drive folders when component mounts - only once
  useEffect(() => {
    if (session && saveToDrive && !foldersLoaded) {
      loadFolders();
    }
  }, [session, saveToDrive, foldersLoaded]);

  // Show a permissions warning if needed
  useEffect(() => {
    const hasPermissionError = localStorage.getItem('drive_permission_error');
    if (hasPermissionError === 'true') {
      setErrorMessage('Your Google account may have insufficient permissions to upload to Drive. Try signing out and back in with full Drive permissions.');
      setFoldersError(true);
    }
  }, []);

  // Helper function to handle permission errors
  const handlePermissionError = () => {
    localStorage.setItem('drive_permission_error', 'true');
    setErrorMessage('Your Google account may have insufficient permissions to upload to Drive. Try signing out and back in with full Drive permissions.');
    setFoldersError(true);
  };

  // Load the folders with better error handling
  const loadFolders = async () => {
    // Don't call setLoadingFolders directly since it seems to have issues
    // Instead, rely on fetchDriveFolders to handle the loading state
    setFoldersError(false);
    setErrorMessage('');

    try {
      console.log('Loading Drive folders...');
      // fetchDriveFolders already handles setting loadingFolders internally
      const result = await fetchDriveFolders();

      if (!result.success) {
        setFoldersError(true);

        if (result.error && (result.error.includes('permission') || result.error.includes('Permission'))) {
          handlePermissionError();
          return;
        }

        if (result.error && result.error.includes('timed out')) {
          setErrorMessage(`${result.error} Try using the "Refresh Auth" button at the top of the page or try again later.`);
        } else if (result.fromCache) {
          if (result.networkError) {
            setErrorMessage('Network connectivity issue. Showing folders from cache. Try refreshing your authentication or check your internet connection.');
          } else {
            setErrorMessage('Showing folders from cache. Some folders may be outdated. Try refreshing your authentication if you need the latest folders.');
          }
        } else {
          setErrorMessage(result.error || 'Failed to load folders from Google Drive');
        }
      } else {
        // Success - clear any permission errors
        localStorage.removeItem('drive_permission_error');
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

  // Add function to handle authentication refresh
  const handleRefreshAuth = async () => {
    toastHelper.info('Attempting to refresh Google authentication...');
    
    try {
      // Clear any cached data that might be causing issues
      localStorage.removeItem('driveFolders');
      localStorage.removeItem('driveFoldersTimestamp');
      localStorage.removeItem('drive_permission_error');
      
      // Redirect to the sign-in page with a force_reauth parameter
      window.location.href = `/api/auth/signin?force_reauth=true&callbackUrl=${encodeURIComponent(window.location.href)}`;
    } catch (error) {
      console.error('Error attempting to refresh authentication:', error);
      toastHelper.error('Failed to refresh authentication');
    }
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
        await fetchDriveFolders(); // Refresh the folder list
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
  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-3 py-1.5 text-xs bg-gray-700 text-gray-300 dark:bg-gray-700/50 dark:text-gray-300 rounded-full inline-flex items-center gap-1.5 font-medium border border-gray-600 dark:border-gray-600 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></span>
            Pending
          </span>
        );
      case 'processing':
        return (
          <span className="px-3 py-1.5 text-xs bg-amber-900/40 text-amber-400 dark:bg-amber-900/40 dark:text-amber-400 rounded-full inline-flex items-center gap-1.5 font-medium border border-amber-800 dark:border-amber-800 shadow-sm">
            <FaSpinner className="animate-spin" size={12} />
            Processing
          </span>
        );
      case 'downloading':
        return (
          <span className="px-3 py-1.5 text-xs bg-amber-900/40 text-amber-400 dark:bg-amber-900/40 dark:text-amber-400 rounded-full inline-flex items-center gap-1.5 font-medium border border-amber-800 dark:border-amber-800 shadow-sm">
            <FaSpinner className="animate-spin" size={12} />
            Downloading
          </span>
        );
      case 'completed':
        return (
          <span className="px-3 py-1.5 text-xs bg-amber-900/40 text-amber-400 dark:bg-amber-900/40 dark:text-amber-400 rounded-full inline-flex items-center gap-1.5 font-medium border border-amber-800 dark:border-amber-800 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="px-3 py-1.5 text-xs bg-red-900/40 text-red-400 dark:bg-red-900/40 dark:text-red-400 rounded-full inline-flex items-center gap-1.5 font-medium border border-red-800 dark:border-red-800 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Failed
          </span>
        );
      default:
        return null;
    }
  };

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

          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <button
              onClick={() => fileInputRef.current.click()}
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
                            setFoldersLoaded(false);
                            const result = await fetchDriveFolders();
                            if (result && result.success) {
                              setFoldersLoaded(true);
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
                          Refresh Folders
                        </button>
                        
                        <button
                          onClick={() => {
                            toastHelper.info('Refreshing Google authentication...');
                            // Clear any cached data
                            localStorage.removeItem('driveFolders');
                            localStorage.removeItem('driveFoldersTimestamp');
                            localStorage.removeItem('drive_permission_error');
                            // Redirect to auth refresh
                            window.location.href = `/api/auth/signin?force_reauth=true&callbackUrl=${encodeURIComponent(window.location.href)}`;
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2 text-xs"
                          title="Refresh Google Authentication"
                        >
                          <FaSyncAlt size={14} />
                          Refresh Auth
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
                              onClick={() => {
                                toastHelper.info('Refreshing Google authentication...');
                                // Clear any cached data
                                localStorage.removeItem('driveFolders');
                                localStorage.removeItem('driveFoldersTimestamp');
                                localStorage.removeItem('drive_permission_error');
                                // Redirect to auth refresh
                                window.location.href = `/api/auth/signin?force_reauth=true&callbackUrl=${encodeURIComponent(window.location.href)}`;
                              }}
                              className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2 text-xs w-auto"
                            >
                              <FaSyncAlt size={14} />
                              Refresh Google Authentication
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

                    {foldersError && (
                      <div className="text-sm text-red-500 dark:text-red-400 mt-2">
                        <p className="font-semibold">Error loading folders:</p>
                        <p>{errorMessage || "Failed to load folders from Google Drive"}</p>
                        <p className="mt-2">
                          <a
                            href="/debug"
                            target="_blank"
                            rel="noopener noreferrer" 
                            className="text-blue-500 hover:underline"
                          >
                            View Drive Debug Info
                          </a>
                        </p>
                      </div>
                    )}
                    
                    {/* Add folder destination display */}
                    {driveFolderId ? (
                      <div className="mt-4 p-3 bg-white dark:bg-gray-800 border border-amber-500 dark:border-amber-500 rounded-md">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                              Videos will be saved to: <span className="font-bold text-amber-600 dark:text-amber-400">{folderName}</span>
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Videos will only be uploaded to Google Drive and not downloaded locally
                            </p>
                          </div>
                          <a
                            href={getDriveFolderUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md flex items-center gap-2 text-sm"
                          >
                            <FaEye size={14} /> View Folder
                          </a>
                        </div>
                      </div>
                    ) : saveToDrive && (
                      <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-md">
                        <div className="flex items-center">
                          <div>
                            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                              Please select or create a folder in Google Drive
                            </p>
                            <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                              Until a folder is selected, videos will be downloaded to your device
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Add local download notice when Drive is disabled */}
                    {!saveToDrive && (
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
                
                {/* Add Google Auth Refresh Button */}
                <button 
                  onClick={handleRefreshAuth}
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors"
                >
                  <FaGoogle />
                  Refresh Auth
                </button>
              </div>
            </div>
          </div>
        )}

        {jsonData && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-medium dark:text-white">Found {videos.length} videos</h2>
              <div className="flex gap-2">
                {videos.length > 0 && (
                  <button
                    onClick={downloadAllVideos}
                    disabled={loading || downloadingAll}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading || downloadingAll ? (
                      <>
                        <FaSpinner className="animate-spin" /> Downloading ({progress}%)
                      </>
                    ) : (
                      <>
                        <FaDownload /> {saveToDrive && driveFolderId ? 'Save All to Drive' : 'Download All Videos'}
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={resetDownloader}
                  disabled={loading || downloadingAll}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Close and clear video list"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Clear List
                </button>
              </div>
            </div>

            {loading && (
              <div className="w-full mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-gray-300 dark:text-gray-300">{progress}% completed</span>
                  <span className="text-xs font-medium text-amber-500 dark:text-amber-500">{Math.round((progress / 100) * videos.length)}/{videos.length} videos</span>
                </div>
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden dark:bg-gray-800 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600 relative overflow-hidden transition-all duration-500 ease-out shadow-sm flex items-center justify-center"
                    style={{ width: `${progress}%` }}
                  >
                    {progress > 10 && (
                      <div className="absolute inset-0 overflow-hidden">
                        <span className="absolute inset-0 bg-white/20 animate-pulse"></span>
                        <span className="absolute top-0 bottom-0 w-8 bg-white/30 -skew-x-30 animate-shimmer"></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentVideo && (
              <div className="mb-6 p-4 bg-white dark:bg-black rounded-lg border border-amber-500 dark:border-amber-500 shadow-sm">
                <div className="flex items-center">
                  <div className="mr-3 flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center animate-pulse">
                      <FaSpinner className="animate-spin text-white" size={14} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Processing video</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{currentVideo.title || currentVideo.url}</p>
                    <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">
                      {saveToDrive && driveFolderId 
                        ? `Saving to Google Drive: ${folderName}` 
                        : 'Downloading to your device'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {videos.length > 0 && (
              <div className="bg-white dark:bg-black rounded-lg shadow-xl p-6 overflow-hidden border border-amber-500 dark:border-amber-500 transition-all hover:shadow-lg">
                <div className="overflow-x-auto rtl-scroll">
                  <table className="w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-black">
                        <th className="px-6 py-4 text-left text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider rounded-tl-lg">Video</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">Link</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider rounded-tr-lg">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {videos.map((video, index) => (
                        <tr key={video.id} className={`transition-colors hover:bg-gray-100 dark:hover:bg-gray-900 border-b border-gray-200 dark:border-gray-800`}>
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
                            </div>
                          </td>
                          <td className="px-6 py-4 text-left">
                            <div className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">{video.url}</div>
                          </td>
                          <td className="px-6 py-4 text-left">
                            {getStatusBadge(video.status)}
                          </td>
                          <td className="px-6 py-4 text-left">
                            <div className="flex flex-col md:flex-row gap-2">
                              <button
                                onClick={() => downloadSingleVideo(video)}
                                disabled={video.status === 'processing' || loading || downloadingAll || downloadingVideoIds.includes(video.id)}
                                className="px-3 py-1.5 rounded-md flex items-center gap-1 transition-all bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:text-white hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
