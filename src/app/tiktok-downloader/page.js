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

function TikTokDownloader() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);

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

function TikTokDownloaderContent() {
  const {
    videos,
    loading,
    downloadingAll,
    downloadAllVideos,
    cancelDownloads,
    progress,
    currentVideo,
    resetDownloader
  } = useTikTok();

  const fileInputRef = useRef(null);
  const { data: session } = useSession();
  const { user } = useUser();

  // Download controls section
  const renderDownloadControls = () => {
    // The key part that fixes the cancel button visibility
    const isDownloading = loading || downloadingAll;

    return (
      <div className="flex gap-2">
        {isDownloading ? (
          <button
            onClick={cancelDownloads}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center gap-2 font-bold shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 animate-pulse"
          >
            <FaStop /> Cancel Downloads
          </button>
        ) : (
          <button
            onClick={downloadAllVideos}
            disabled={!videos.length}
            className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaDownload />
            Download All Videos
          </button>
        )}
        
        <button
          onClick={resetDownloader}
          disabled={isDownloading}
          className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md flex items-center gap-2 disabled:opacity-50"
        >
          <FaTrash />
          Reset
        </button>
      </div>
    );
  };

  return (
    <PageContainer>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">TikTok Video Downloader</h1>
        
        <div className="mb-6">
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
        </div>

        {videos.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">Found {videos.length} videos</h2>
                {currentVideo && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Currently processing: {currentVideo.title}
                  </p>
                )}
              </div>
              {renderDownloadControls()}
            </div>

            {loading && (
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 dark:bg-amber-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left">Title</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {videos.map((video) => (
                    <tr key={video.id}>
                      <td className="px-6 py-4">{video.title}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-sm ${
                          video.status === 'completed'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : video.status === 'failed'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            : video.status === 'downloading'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                        }`}>
                          {video.status.charAt(0).toUpperCase() + video.status.slice(1)}
                          {video.progress > 0 && video.progress < 100 && ` (${video.progress}%)`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {video.status === 'failed' && video.error && (
                          <span className="text-sm text-red-600 dark:text-red-400">
                            {video.error}
                          </span>
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
    </PageContainer>
  );
}

export default TikTokDownloader;
