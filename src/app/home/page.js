'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { FaYoutube, FaUpload, FaSync, FaHistory, FaEye, FaThumbsUp, FaCalendarAlt, FaClock, FaCloudUploadAlt, FaTable, FaDownload } from 'react-icons/fa';
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { useDrive } from '@/contexts/DriveContext';
import { useUpload } from '@/contexts/UploadContext';
import { useYouTube } from '@/contexts/YouTubeContext';
import { useDataFetching } from '@/hooks/useDataFetching';
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
    <HomeDashboard 
      session={session}
      status={status}
    />
  );
}

// Separate component that only renders on the client
function HomeDashboard({ session, status }) {
  const router = useRouter();
  
  // Use our context hooks
  const { user, loading: userLoading, error: userError } = useUser();
  const { 
    driveFiles, 
    selectedFile, 
    loading: driveLoading, 
    error: driveError,
    selectFile,
    clearSelectedFile
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
    isQuotaError
  } = useYouTube();

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
  const [activeTab, setActiveTab] = useState('drive');

  // Combined loading and error states
  const loadingCombined = userLoading || dataLoading || uploadLoading;
  const error = userError || dataError || uploadError;

  // Handle file selection for immediate upload
  const handleFileSelect = (file) => {
    selectFile(file);
    setTitle(file.name.replace('.mp4', ''));
  };

  // Handle file selection for scheduling
  const handleScheduleSelect = (file) => {
    if (selectedFiles.some(f => f.id === file.id)) {
      setSelectedFiles(selectedFiles.filter(f => f.id !== file.id));
    } else {
      setSelectedFiles([...selectedFiles, file]);
    }
  };

  // Select all files for scheduling
  const selectAllFiles = () => {
    if (selectedFiles.length === driveFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles([...driveFiles]);
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

  // Check if authentication has expired
  useEffect(() => {
    if (error && typeof error === 'string' && error.includes('Your YouTube authentication has expired')) {
      setAuthExpired(true);
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
      
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <FaYoutube className="text-red-600 text-3xl" />
          <h1 className="text-2xl font-bold dark:text-amber-50">YouTube Drive Uploader</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <ThemeToggle />
          
          <ClientOnly>
            {user && (
              <div className="flex items-center gap-2">
                {user.image && (
                  <Image 
                    src={user.image}
                    alt={user.name || 'User'}
                    width={32}
                    height={32}
                    className="rounded-full border dark:border-amber-500/30"
                  />
                )}
                <span className="text-sm font-medium dark:text-amber-50">{user.name}</span>
              </div>
            )}
          </ClientOnly>
          
          <RefreshButton 
            onSuccess={handleRefreshSuccess} 
            onError={handleRefreshError}
            className="text-sm" 
          />
          
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Use the Navbar component */}
      <Navbar />

      {/* Scrollable content area */}
      <div className="mt-4 pb-16">
      {error && (
        <AuthErrorBanner 
          message={typeof error === 'object' ? error.message : error} 
          isNetworkError={typeof error === 'object' && error.isNetworkError}
          failureCount={typeof error === 'object' && error.failureCount}
          maxFailures={typeof error === 'object' && error.maxFailures}
          forceSignOut={typeof error === 'object' && error.forceSignOut}
          isAccessRevoked={typeof error === 'object' && error.isAccessRevoked}
        />
      )}

      <ClientOnly>
        <div className="flex flex-col gap-8 ">
          {/* Drive Files and Upload Sections */}
            <div className="bg-white dark:bg-black rounded-lg shadow-md p-6 border dark:border-amber-700/30 transition-all duration-300">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold dark:text-amber-50">Manage Content</h2>
              <div className="flex gap-2">
                <button
                  onClick={refreshDrive}
                    className="p-2 bg-blue-100 text-blue-600 dark:bg-amber-900/30 dark:text-amber-300 rounded-full hover:bg-blue-200 dark:hover:bg-amber-800/40 transition-all duration-300 transform hover:rotate-12"
                  disabled={loadingCombined}
                  title="Refresh Drive Files"
                >
                  <FaSync className={loadingCombined ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={refreshYouTube}
                    className="p-2 bg-red-100 text-red-600 dark:bg-amber-900/30 dark:text-amber-300 rounded-full hover:bg-red-200 dark:hover:bg-amber-800/40 transition-all duration-300 transform hover:rotate-12"
                  disabled={loadingCombined}
                  title="Refresh YouTube videos"
                >
                  <FaSync className={youtubeLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            
            {/* Tabs for Drive and Upload */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
              <button
                onClick={() => setActiveTab('drive')}
                className={`px-4 py-2.5 border-b-2 font-medium transition-colors ${
                  activeTab === 'drive'
                      ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FaYoutube className={activeTab === 'drive' ? 'text-red-500' : 'text-gray-400'} />
                  Drive to YouTube
                </span>
              </button>
              <button
                onClick={() => setActiveTab('schedule')}
                className={`px-4 py-2.5 border-b-2 font-medium transition-colors ${
                  activeTab === 'schedule'
                      ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                    <FaCalendarAlt className={activeTab === 'schedule' ? 'text-amber-500' : 'text-gray-400'} />
                  Schedule Uploads
                </span>
              </button>
            </div>
            
            <div className="grid md:grid-cols-4 gap-6">
              {/* Drive Files Column - now spans 1 out of 4 columns (25%) */}
              <div className="md:col-span-1">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-medium dark:text-amber-50">Your Drive Videos</h3>
                  {driveFiles.length > 0 && activeTab === 'schedule' && (
                    <button 
                      onClick={selectAllFiles}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-black/60 dark:hover:bg-black/80 text-gray-700 dark:text-amber-200/70 rounded border dark:border-amber-700/30"
                    >
                      {selectedFiles.length === driveFiles.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>
                  <div className="overflow-y-auto max-h-[400px] pr-1 rounded-lg bg-white/50 dark:bg-black shadow-inner border dark:border-amber-700/20 transition-all duration-300">
                  {driveFiles.length > 0 ? (
                      <div className="space-y-3 p-2">
                      {driveFiles.map((file) => (
                        <div
                          key={file.id}
                            className={`p-3 border rounded-lg cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md transform hover:-translate-y-1 ${
                            selectedFile?.id === file.id 
                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500' 
                              : selectedFiles.some(f => f.id === file.id)
                                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-400'
                                : 'border-gray-200 dark:border-amber-800/30 hover:bg-gray-50 dark:hover:bg-black/50'
                          }`}
                          onClick={() => activeTab === 'drive' ? handleFileSelect(file) : handleScheduleSelect(file)}
                        >
                          <div className="flex items-center gap-3">
                            {activeTab === 'schedule' && (
                              <input 
                                type="checkbox" 
                                checked={selectedFiles.some(f => f.id === file.id)}
                                onChange={() => handleScheduleSelect(file)}
                                onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 text-amber-600 mr-2"
                              />
                            )}
                              <div className="w-14 h-14 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden shadow-sm border border-gray-100 dark:border-amber-700/30 transition-all duration-300">
                              {file.thumbnailLink ? (
                                <Image 
                                  src={file.thumbnailLink} 
                                  alt={file.name}
                                    width={56}
                                    height={56}
                                    className="object-cover w-full h-full"
                                />
                              ) : (
                                  <FaYoutube className="text-red-500 text-2xl" />
                              )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="font-medium dark:text-amber-50 truncate">{file.name}</p>
                                <p className="text-xs text-gray-500 dark:text-amber-200/60 mt-1 flex items-center gap-1">
                                  <FaCalendarAlt className="text-gray-400 dark:text-amber-500/70" size={10} />
                                {new Date(file.createdTime).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : loadingCombined ? (
                      <div className="flex flex-col items-center justify-center py-10 text-gray-500 dark:text-amber-200/70">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 dark:border-amber-500 mb-3"></div>
                        <p>Loading videos...</p>
                      </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-gray-500 dark:text-amber-200/70">
                        <FaYoutube className="text-gray-300 dark:text-amber-700/50 text-4xl mb-3" />
                        <p>No MP4 videos found in your Drive</p>
                      </div>
                  )}
                </div>
              </div>
              
              {/* Upload Form Column - now spans 3 out of 4 columns (75%) */}
              <div className="md:col-span-3">
                {activeTab === 'drive' ? (
                  <>
                      <h3 className="text-lg font-medium dark:text-amber-50 mb-3">Upload to YouTube</h3>
                    <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-amber-200/80 mb-1">Title</label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-amber-700/30 dark:bg-black dark:text-amber-50 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="Video title (will add #Shorts automatically)"
                        />
                      </div>
                      
                      <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-amber-200/80 mb-1">Description</label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-amber-700/30 dark:bg-black dark:text-amber-50 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                          rows="3"
                          placeholder="Video description"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={uploadToYouTube}
                          disabled={!selectedFile || uploadLoading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed border border-transparent dark:border-amber-500/20 transition-all duration-300 transform hover:scale-105"
                        >
                          {uploadLoading ? (
                            <FaSync className="animate-spin" />
                          ) : (
                            <FaUpload />
                          )}
                          Upload Now
                        </button>
                      </div>
                      
                      {uploadingFileId && !uploadComplete && (
                        <UploadProgress fileId={uploadingFileId} />
                      )}
                      
                      {uploadStatus && (
                        <div className={`mt-4 p-4 rounded-md ${
                          uploadStatus.success 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                        }`}>
                          <p className="font-medium">{uploadStatus.message}</p>
                          {uploadStatus.videoUrl && (
                            <a 
                              href={uploadStatus.videoUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                                className="mt-2 inline-block text-blue-600 hover:underline dark:text-amber-400"
                            >
                              View on YouTube
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
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
                          <h3 className="text-lg font-medium dark:text-amber-50 mb-3">Schedule Selected Videos</h3>
                          <p className="text-gray-600 dark:text-amber-200/60">
                          Select videos from the list to schedule them for upload.
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* YouTube Connection Status */}
          <YouTubeConnectionStatus onRefreshSuccess={handleRefreshSuccess} />
        </div>
      </ClientOnly>
      </div>
    </div>
  );
} 