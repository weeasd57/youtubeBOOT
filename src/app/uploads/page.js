'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { FaUpload, FaSync, FaHistory, FaCalendarAlt, FaTable, FaClock, FaSpinner } from 'react-icons/fa';
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { useUploadLogs } from '@/contexts/UploadLogsContext';
import { useScheduledUploads } from '@/contexts/ScheduledUploadsContext';
import { useDataFetching } from '@/hooks/useDataFetching';
import ClientOnly from '@/components/ClientOnly';
import ThemeToggle from '@/components/ThemeToggle';
import ScheduledUploadList from '@/components/ScheduledUploadList';
import Link from 'next/link';
import { useDrive } from '@/contexts/DriveContext';
import ScheduleUploadForm from '@/components/ScheduleUploadForm';
import PageContainer from '@/components/PageContainer';

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

export default function UploadsPage() {
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
  
  return <UploadsContent />;
}

// Separate content component that uses context hooks
function UploadsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Use our context hooks
  const { user, loading: userLoading } = useUser();
  const { logs, loading: logsLoading } = useUploadLogs();
  const { refreshScheduledUploads } = useScheduledUploads();
  const { driveFiles, loading: driveLoading } = useDrive();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  // Use our new optimized data fetching hook
  const {
    loading: dataLoading,
    initialLoading,
    error: dataError,
    refreshAll
  } = useDataFetching();

  // Combined loading state
  const loadingCombined = userLoading || logsLoading || dataLoading;

  // Redirect to landing page if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Format date to be more readable
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Handle file selection
  const handleFileSelect = (file) => {
    if (selectedFiles.some(f => f.id === file.id)) {
      setSelectedFiles(selectedFiles.filter(f => f.id !== file.id));
    } else {
      setSelectedFiles([...selectedFiles, file]);
    }
  };

  // Check if a file is selected
  const isFileSelected = (fileId) => {
    return selectedFiles.some(f => f.id === fileId);
  };

  // Select all files
  const selectAllFiles = () => {
    if (selectedFiles.length === driveFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles([...driveFiles]);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    refreshScheduledUploads();
    refreshAll(true);
  };

  // Show loading spinner while checking authentication
  if (status === 'loading' || (status === 'authenticated' && initialLoading)) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center dark:bg-black" suppressHydrationWarning>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-amber-500" suppressHydrationWarning></div>
      </div>
    );
  }

  return (
    <PageContainer user={user} onRefresh={handleRefresh}>
      <div className="mt-4 pb-16">
      <div className="mb-6">
          <h2 className="text-2xl font-semibold dark:text-amber-50 mb-2">Uploads Management</h2>
          <p className="text-gray-600 dark:text-amber-200/60">
          Manage your scheduled uploads and view upload history
        </p>
      </div>

        <div className="flex flex-col gap-8">
          {/* Scheduled Uploads Section */}
          <div className="bg-white dark:bg-black rounded-lg shadow-md p-4 sm:p-6 border dark:border-amber-700/30 transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4 sm:mb-6">
              <div className="flex items-center gap-2">
                <FaCalendarAlt className="text-amber-500" />
                <h2 className="text-xl font-semibold dark:text-amber-50">Scheduled Uploads</h2>
              </div>
              <button
                onClick={handleRefresh}
                className="p-2 bg-blue-100 text-blue-600 dark:bg-amber-900/30 dark:text-amber-300 rounded-full hover:bg-blue-200 dark:hover:bg-amber-800/40 transition-all duration-300 transform hover:rotate-12 self-end sm:self-auto"
                title="Refresh Data"
                disabled={loadingCombined}
              >
                <FaSync className={loadingCombined ? 'animate-spin' : ''} />
              </button>
            </div>
            
            <ScheduledUploadList />
          </div>
          
          {/* Upload History Section */}
          {logs && logs.length > 0 && (
            <div className="bg-white dark:bg-black rounded-lg shadow-md p-4 sm:p-6 border dark:border-amber-700/30 transition-all duration-300">
              <div className="flex items-center gap-2 mb-4">
                <FaHistory className="text-amber-500" />
                <h2 className="text-xl font-semibold dark:text-amber-50">Upload History</h2>
              </div>
              
              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-amber-800/30">
                  <thead className="bg-gray-50 dark:bg-black/50">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-amber-300 uppercase tracking-wider">Date</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-amber-300 uppercase tracking-wider">File</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-amber-300 uppercase tracking-wider">Title</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-amber-300 uppercase tracking-wider">Status</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-amber-300 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-black divide-y divide-gray-200 dark:divide-amber-800/20">
                    {logs.map((log) => (
                      <tr key={log.id} className="transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-black/40">
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 dark:text-amber-200/70 break-words sm:whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 dark:text-amber-50 truncate max-w-[100px] sm:max-w-none sm:whitespace-nowrap">
                          {log.file_name}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 dark:text-amber-50 truncate max-w-[100px] sm:max-w-none sm:whitespace-nowrap">
                          {log.title}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center sm:text-left">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            log.status === 'success' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                          }`}>
                            {log.status === 'success' ? 'Success' : 'Failed'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-center sm:text-left">
                          {log.youtube_id && log.status === 'success' && (
                            <a 
                              href={`https://www.youtube.com/watch?v=${log.youtube_id}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-900 dark:text-amber-400 dark:hover:text-amber-300 transition-all duration-200"
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
          
          {/* Create New Schedule Button */}
          <div className="flex justify-center sm:justify-end">
            <Link
              href="/home?tab=schedule"
              className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-center rounded-md flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-300 transform hover:translate-y-[-2px] border border-transparent dark:border-amber-500/20"
            >
              <FaCalendarAlt />
              Schedule New Uploads
            </Link>
          </div>
        </div>
    </div>
    </PageContainer>
  );
} 