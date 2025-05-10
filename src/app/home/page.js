'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { FaYoutube, FaUpload, FaSync, FaHistory, FaEye, FaThumbsUp, FaCalendarAlt, FaClock, FaCloudUploadAlt, FaTable } from 'react-icons/fa';
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

export default function Home() {
  const { data: session, status } = useSession();
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
      <div className="min-h-screen p-8 flex items-center justify-center dark:bg-gray-900" suppressHydrationWarning>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" suppressHydrationWarning></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 flex flex-col dark:bg-gray-900">
      {/* Auto refresh the token when YouTube auth has expired */}
      {authExpired && <AutoRefresh onSuccess={handleRefreshSuccess} onError={handleRefreshError} />}
      
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <FaYoutube className="text-red-600 text-3xl" />
          <h1 className="text-2xl font-bold dark:text-white">YouTube Drive Uploader</h1>
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
                    className="rounded-full"
                  />
                )}
                <span className="text-sm font-medium dark:text-white">{user.name}</span>
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

      {/* Center Navbar */}
      <div className="flex justify-center mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md flex overflow-hidden">
          <Link
            href="/home"
            className="px-6 py-3 bg-blue-600 text-white font-medium flex items-center gap-2"
          >
            <FaYoutube />
            Dashboard
          </Link>
          <Link
            href="/uploads"
            className="px-6 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium flex items-center gap-2"
          >
            <FaTable />
            Schedules
          </Link>
        </div>
      </div>

      {error && error.includes('Invalid Credentials') ? (
        <AuthErrorBanner message={error} />
      ) : error && !authExpired ? (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-md">
          <p>{error}</p>
        </div>
      ) : null}

      <ClientOnly>
        <div className="flex flex-col gap-8 ">
          {/* Drive Files and Upload Sections */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold dark:text-white">Manage Content</h2>
              <div className="flex gap-2">
                <button
                  onClick={refreshDrive}
                  className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                  disabled={loadingCombined}
                  title="Refresh Drive Files"
                >
                  <FaSync className={loadingCombined ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={refreshYouTube}
                  className="p-2 bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300 rounded-full hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
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
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
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
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FaCalendarAlt className={activeTab === 'schedule' ? 'text-blue-500' : 'text-gray-400'} />
                  Schedule Uploads
                </span>
              </button>
            </div>
            
            <div className="grid md:grid-cols-4 gap-6">
              {/* Drive Files Column - now spans 1 out of 4 columns (25%) */}
              <div className="md:col-span-1">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-medium dark:text-white">Your Drive Videos</h3>
                  {driveFiles.length > 0 && activeTab === 'schedule' && (
                    <button 
                      onClick={selectAllFiles}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                    >
                      {selectedFiles.length === driveFiles.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto max-h-[300px]">
                  {driveFiles.length > 0 ? (
                    <div className="space-y-2">
                      {driveFiles.map((file) => (
                        <div
                          key={file.id}
                          className={`p-3 border rounded-md cursor-pointer transition-colors ${
                            selectedFile?.id === file.id 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400' 
                              : selectedFiles.some(f => f.id === file.id)
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/30 dark:border-green-400'
                              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30'
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
                                className="w-4 h-4 text-blue-600 mr-2"
                              />
                            )}
                            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center overflow-hidden">
                              {file.thumbnailLink ? (
                                <Image 
                                  src={file.thumbnailLink} 
                                  alt={file.name}
                                  width={48}
                                  height={48}
                                  className="object-cover"
                                />
                              ) : (
                                <FaYoutube className="text-red-500 text-xl" />
                              )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <p className="font-medium dark:text-white truncate">{file.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(file.createdTime).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : loadingCombined ? (
                    <p className="text-center py-4 text-gray-500 dark:text-gray-400">Loading videos...</p>
                  ) : (
                    <p className="text-center py-4 text-gray-500 dark:text-gray-400">No MP4 videos found in your Drive</p>
                  )}
                </div>
              </div>
              
              {/* Upload Form Column - now spans 3 out of 4 columns (75%) */}
              <div className="md:col-span-3">
                {activeTab === 'drive' ? (
                  <>
                    <h3 className="text-lg font-medium dark:text-white mb-3">Upload to YouTube</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Video title (will add #Shorts automatically)"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows="3"
                          placeholder="Video description"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={uploadToYouTube}
                          disabled={!selectedFile || uploadLoading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
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
                              className="mt-2 inline-block text-blue-600 hover:underline dark:text-blue-400"
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
                        <h3 className="text-lg font-medium dark:text-white mb-3">Schedule Selected Videos</h3>
                        <p className="text-gray-600 dark:text-gray-400">
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
  );
} 