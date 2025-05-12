'use client';

import { useRef, useState, useEffect } from 'react';
import { FaFileUpload, FaDownload, FaSpinner, FaEye, FaYoutube } from 'react-icons/fa';
import { useSession } from 'next-auth/react';
import Image from "next/image";
import Link from "next/link";
import { useUser } from '@/contexts/UserContext';
import { useTikTok } from '@/contexts/TikTokContext';
import ClientOnly from '@/components/ClientOnly';
import Navbar from '@/components/Navbar';
import PageContainer from '@/components/PageContainer';

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
`;

export default function TikTokDownloader() {
  const [isMounted, setIsMounted] = useState(false);
  
  // Use useEffect to mark component as mounted
  useEffect(() => {
    setIsMounted(true);
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
    fetchDriveFolders,
    useExistingFolder,
    getDriveFolderUrl,
    createDriveFolder,
    handleFileUpload: handleFileUploadAction,
    downloadAllVideos,
    downloadSingleVideo
  } = useTikTok();
  
  const fileInputRef = useRef(null);
  const { data: session } = useSession();
  const { user } = useUser();
  const [showNewFolder, setShowNewFolder] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [foldersError, setFoldersError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load drive folders when component mounts - only once
  useEffect(() => {
    if (session && saveToDrive && !foldersLoaded) {
      loadFolders();
    }
  }, [session, saveToDrive, foldersLoaded]);

  // Function to load folders and handle errors
  const loadFolders = async () => {
    try {
      setFoldersError(false);
      setErrorMessage('');
      const result = await fetchDriveFolders();
      
      if (!result || !result.success) {
        setFoldersError(true);
        // If we have a specific error message, show it
        if (result && result.error) {
          setErrorMessage(result.error);
          console.error("Error loading folders:", result.error);
        }
      } else {
        setFoldersLoaded(true);
        // If folders were loaded from cache, show a warning
        if (result.fromCache) {
          setErrorMessage("Using cached folder list. Some folders may be missing or outdated. Try refreshing your authentication.");
        }
      }
    } catch (error) {
      setFoldersError(true);
      setErrorMessage(error.message || 'Unknown error occurred');
      console.error("Error loading folders:", error);
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
      alert("Please enter a folder name");
      return;
    }
    
    setLoadingFolders(true);
    try {
      const folderId = await createDriveFolder();
      if (folderId) {
        // Refresh the folder list
        const result = await fetchDriveFolders();
        
        if (result && result.success) {
          // Find the newly created folder in the list
          const newFolder = result.folders.find(f => f.id === folderId);
          if (newFolder) {
            // Select the new folder
            setSelectedFolderId(folderId);
            useExistingFolder(folderId, newFolder.name);
            setShowNewFolder(false);
          }
        }
        
        // Show success message
        alert("Folder created successfully!");
      } else {
        alert("Failed to create folder");
      }
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("Error creating folder: " + (error.message || "Unknown error"));
    } finally {
      setLoadingFolders(false);
    }
  };

  // Handle folder selection change
  const handleFolderChange = (e) => {
    const folderId = e.target.value;
    setSelectedFolderId(folderId);
    
    if (folderId) {
      const folder = driveFolders.find(f => f.id === folderId);
      if (folder) {
        useExistingFolder(folder.id, folder.name);
        setShowNewFolder(false);
      }
    } else {
      setShowNewFolder(true);
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

  // Status badge component
  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300 rounded-full inline-flex items-center gap-1.5 font-medium border border-gray-200 dark:border-gray-600 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></span>
            Pending
          </span>
        );
      case 'processing':
        return (
          <span className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-full inline-flex items-center gap-1.5 font-medium border border-blue-200 dark:border-blue-800 shadow-sm">
            <FaSpinner className="animate-spin" size={12} />
            Processing
          </span>
        );
      case 'downloading':
        return (
          <span className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 rounded-full inline-flex items-center gap-1.5 font-medium border border-purple-200 dark:border-purple-800 shadow-sm">
            <FaSpinner className="animate-spin" size={12} />
            Downloading
          </span>
        );
      case 'completed':
        return (
          <span className="px-3 py-1.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded-full inline-flex items-center gap-1.5 font-medium border border-green-200 dark:border-green-800 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="px-3 py-1.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded-full inline-flex items-center gap-1.5 font-medium border border-red-200 dark:border-red-800 shadow-sm">
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
          
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <button
              onClick={() => fileInputRef.current.click()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2"
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
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="text-lg font-medium mb-3 dark:text-white">Google Drive Settings</h3>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="saveToDrive"
                    checked={saveToDrive}
                    onChange={(e) => setSaveToDrive(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label htmlFor="saveToDrive" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Save to Google Drive
                  </label>
                </div>
                
                {saveToDrive && (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="folderSelect" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Select Existing Folder
                      </label>
                      <div className="flex gap-2 items-center">
                        <select
                          id="folderSelect"
                          value={selectedFolderId}
                          onChange={handleFolderChange}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          disabled={loadingFolders}
                        >
                          <option value="">-- Select a folder --</option>
                          {driveFolders.map(folder => (
                            <option key={folder.id} value={folder.id}>
                              {folder.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={loadFolders}
                          disabled={loadingFolders}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2 disabled:opacity-50"
                          title={foldersError ? "Retry loading folders" : "Refresh folders list"}
                        >
                          {loadingFolders ? (
                            <FaSpinner className="animate-spin" size={16} />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {loadingFolders && (
                        <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                          Loading folders...
                        </p>
                      )}
                      {foldersError && (
                        <div className="text-xs text-red-500 dark:text-red-400 mt-1">
                          <p>Error loading folders. Please try again.</p>
                          {errorMessage && (
                            <p className="mt-1 font-medium">{errorMessage}</p>
                          )}
                          {errorMessage && errorMessage.includes('timed out') && (
                            <p className="mt-2 text-blue-600 dark:text-blue-400">
                              Try using the <span className="font-bold">Refresh Auth</span> button in the top right corner.
                            </p>
                          )}
                        </div>
                      )}
                      {!loadingFolders && !foldersError && errorMessage && errorMessage.includes('cached') && (
                        <div className="text-xs text-amber-500 dark:text-amber-400 mt-1">
                          <p className="font-medium">{errorMessage}</p>
                        </div>
                      )}
                      {!loadingFolders && !foldersError && !errorMessage && driveFolders.length === 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          No folders found in your Google Drive
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="createNewFolder"
                        checked={showNewFolder}
                        onChange={(e) => {
                          setShowNewFolder(e.target.checked);
                          if (!e.target.checked && driveFolders.length > 0) {
                            // Select the first folder if unchecking "create new"
                            setSelectedFolderId(driveFolders[0].id);
                            useExistingFolder(driveFolders[0].id, driveFolders[0].name);
                          }
                        }}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <label htmlFor="createNewFolder" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Create new folder
                      </label>
                    </div>
                    
                    {showNewFolder && (
                      <div className="flex flex-col gap-1">
                        <label htmlFor="folderName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          New Folder Name
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            id="folderName"
                            value={folderName}
                            onChange={handleFolderNameChange}
                            placeholder="Enter folder name"
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                          <button
                            onClick={handleCreateFolder}
                            disabled={loadingFolders || !folderName.trim()}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2 disabled:opacity-50"
                          >
                            {loadingFolders ? (
                              <FaSpinner className="animate-spin" size={16} />
                            ) : (
                              "Create Folder"
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Videos will be saved to this new folder in your Google Drive
                        </p>
                      </div>
                    )}
                    
                    {driveFolderId && (
                      <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-800 dark:text-green-300">
                              Videos will be saved to: <span className="font-bold">{folderName}</span>
                            </p>
                          </div>
                          <a
                            href={getDriveFolderUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center gap-2 text-sm"
                          >
                            <FaEye size={14} /> View Folder
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {jsonData && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-medium dark:text-white">Found {videos.length} videos</h2>
              {videos.length > 0 && (
                <button
                  onClick={downloadAllVideos}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <FaSpinner className="animate-spin" /> Downloading ({progress}%)
                    </>
                  ) : (
                    <>
                      <FaDownload /> Download All Videos
                    </>
                  )}
                </button>
              )}
            </div>

            {loading && (
              <div className="w-full mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{progress}% completed</span>
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{Math.round((progress / 100) * videos.length)}/{videos.length} videos</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden dark:bg-gray-700 shadow-inner">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 relative overflow-hidden transition-all duration-500 ease-out shadow-sm flex items-center justify-center"
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
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/10 rounded-lg border border-blue-200 dark:border-blue-800/30 shadow-sm">
                <div className="flex items-center">
                  <div className="mr-3 flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                      <FaSpinner className="animate-spin text-white" size={14} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Processing video</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{currentVideo.title || currentVideo.url}</p>
                  </div>
                </div>
              </div>
            )}

            {videos.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 overflow-hidden border border-gray-100 dark:border-gray-700 transition-all hover:shadow-lg">
                <div className="overflow-x-auto rtl-scroll">
                  <table className="w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20">
                        <th className="px-6 py-4 text-left text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider rounded-tl-lg">Video</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Link</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider rounded-tr-lg">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {videos.map((video, index) => (
                        <tr key={video.id} className={`transition-colors ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-blue-50/50 dark:bg-gray-800/80'} hover:bg-blue-100/50 dark:hover:bg-blue-900/20`}>
                          <td className="px-6 py-4 text-left">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">{video.title}</div>
                          </td>
                          <td className="px-6 py-4 text-left">
                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{video.url}</div>
                          </td>
                          <td className="px-6 py-4 text-left">
                            {getStatusBadge(video.status)}
                          </td>
                          <td className="px-6 py-4 text-left">
                            <div className="flex flex-col md:flex-row gap-2">
                              <button
                                onClick={() => downloadSingleVideo(video)}
                                disabled={video.status === 'processing' || loading}
                                className={`px-3 py-1.5 rounded-md flex items-center gap-1 transition-all ${
                                  video.status === 'completed' 
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 hover:scale-105' 
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 hover:scale-105'
                                } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                              >
                                <FaDownload size={12} />
                                Download
                              </button>
                              {video.status === 'failed' && (
                                <button
                                  onClick={() => window.open(video.url, '_blank')}
                                  className="px-3 py-1.5 rounded-md flex items-center gap-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 hover:scale-105 transition-all"
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