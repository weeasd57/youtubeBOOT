'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { FaYoutube, FaUpload, FaSync, FaHistory, FaEye, FaThumbsUp, FaCalendarAlt, FaClock } from 'react-icons/fa';
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { useDrive } from '@/contexts/DriveContext';
import { useUpload } from '@/contexts/UploadContext';
import { useUploadLogs } from '@/contexts/UploadLogsContext';
import { useYouTube } from '@/contexts/YouTubeContext';
import ClientOnly from '@/components/ClientOnly';
import ThemeToggle from '@/components/ThemeToggle';
import { useScheduledUploads } from '@/contexts/ScheduledUploadsContext';
import ScheduleUploadForm from '@/components/ScheduleUploadForm';
import ScheduledUploadList from '@/components/ScheduledUploadList';
import AuthErrorBanner from '@/components/AuthErrorBanner';

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
    fetchDriveFiles,
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
    autoUploadEnabled,
    error: uploadError,
    uploadToYouTube,
    checkNewVideos,
    toggleAutoUpload
  } = useUpload();
  const { logs, loading: logsLoading } = useUploadLogs();
  const { videos, loading: youtubeLoading, refreshVideos } = useYouTube();
  const { refreshScheduledUploads } = useScheduledUploads();

  // Add state for showing schedule form
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  // Combined loading and error states
  const loading = userLoading || driveLoading || uploadLoading || logsLoading || youtubeLoading;
  const error = userError || driveError || uploadError;

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

  // Format view count to be more readable
  const formatViewCount = (count) => {
    if (!count) return '0';
    if (count < 1000) return count;
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  };

  // Format date to be more readable
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Show loading spinner while checking authentication
  if (status === 'loading' || (status === 'authenticated' && loading && !driveFiles.length)) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center dark:bg-gray-900" suppressHydrationWarning>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" suppressHydrationWarning></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 flex flex-col dark:bg-gray-900">
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
          
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
          >
            Sign Out
          </button>
        </div>
      </header>

      {error && error.includes('Invalid Credentials') ? (
        <AuthErrorBanner message={error} />
      ) : error ? (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-md">
          <p>{error}</p>
        </div>
      ) : null}

      <ClientOnly>
        <div className="flex flex-col gap-8">
          {/* Drive Files and Upload Sections */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold dark:text-white">Manage Content</h2>
              <div className="flex gap-2">
                <button
                  onClick={fetchDriveFiles}
                  className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                  disabled={loading}
                  title="Refresh Drive Files"
                >
                  <FaSync className={loading ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={refreshVideos}
                  className="p-2 bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300 rounded-full hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                  disabled={loading}
                  title="Refresh YouTube Videos"
                >
                  <FaYoutube />
                </button>
              </div>
            </div>
            
            {/* Tabs for Drive and Upload */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
              <button
                className="px-4 py-2 border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
              >
                Drive to YouTube
              </button>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Drive Files Column */}
              <div>
                <h3 className="text-lg font-medium dark:text-white mb-3">Your Drive Videos</h3>
                <div className="overflow-y-auto max-h-[300px]">
                  {driveFiles.length > 0 ? (
                    <div className="space-y-2">
                      {driveFiles.map((file) => (
                        <div
                          key={file.id}
                          className={`p-3 border rounded-md cursor-pointer transition-colors ${
                            selectedFile?.id === file.id 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400' 
                              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                          }`}
                          onClick={() => {
                            selectFile(file);
                            setTitle(file.name.replace('.mp4', ''));
                          }}
                        >
                          <div className="flex items-center gap-3">
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
                  ) : loading ? (
                    <p className="text-center py-4 text-gray-500 dark:text-gray-400">Loading videos...</p>
                  ) : (
                    <p className="text-center py-4 text-gray-500 dark:text-gray-400">No MP4 videos found in your Drive</p>
                  )}
                </div>
              </div>
              
              {/* Upload Form Column */}
              <div>
                {showScheduleForm && selectedFile ? (
                  <ScheduleUploadForm 
                    file={selectedFile} 
                    onScheduled={() => {
                      setShowScheduleForm(false);
                      setTitle('');
                      setDescription('');
                      clearSelectedFile();
                    }}
                    onCancel={() => setShowScheduleForm(false)}
                  />
                ) : (
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
                          disabled={!selectedFile || loading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? (
                            <FaSync className="animate-spin" />
                          ) : (
                            <FaUpload />
                          )}
                          Upload Now
                        </button>
                        
                        <button
                          onClick={() => setShowScheduleForm(true)}
                          disabled={!selectedFile || loading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FaClock />
                          Schedule
                        </button>
                      </div>
                      
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
                )}
              </div>
            </div>
          </div>
          
          {/* Scheduled Uploads Section */}
          <ScheduledUploadList />
          
          {/* YouTube Videos Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold dark:text-white flex items-center gap-2">
                <FaYoutube className="text-red-500" />
                Your YouTube Videos
              </h2>
              <button
                onClick={refreshVideos}
                className="p-2 bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300 rounded-full hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                disabled={youtubeLoading}
              >
                <FaSync className={youtubeLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            
            {youtubeLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
              </div>
            ) : videos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map(video => (
                  <div key={video.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg shadow overflow-hidden">
                    <div className="w-full aspect-video relative bg-gray-200 dark:bg-gray-600">
                      <Image
                        src={video.thumbnailUrl}
                        alt={video.title}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <a 
                          href={video.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-red-600 text-white p-3 rounded-full"
                        >
                          <FaYoutube className="text-xl" />
                        </a>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2 mb-2">{video.title}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <FaEye className="text-xs" />
                          <span>{formatViewCount(video.viewCount)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FaThumbsUp className="text-xs" />
                          <span>{formatViewCount(video.likeCount)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FaCalendarAlt className="text-xs" />
                          <span>{formatDate(video.publishedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>No videos found on your YouTube channel</p>
              </div>
            )}
          </div>
          
          {/* Upload History Section */}
          {logs && logs.length > 0 && (
            <div className="mt-8 w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center gap-2 mb-4">
                <FaHistory className="text-blue-500" />
                <h2 className="text-xl font-semibold dark:text-white">Recent Uploads</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">File</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {logs.slice(0, 5).map((log) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                          {log.file_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                          {log.title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            log.status === 'success' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {log.status === 'success' ? 'Success' : 'Failed'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {log.youtube_url && (
                            <a 
                              href={log.youtube_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                              View
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </ClientOnly>
    </div>
  );
} 