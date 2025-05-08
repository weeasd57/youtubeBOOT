'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { FaYoutube, FaUpload, FaSync, FaHistory, FaCalendarAlt, FaTable, FaClock } from 'react-icons/fa';
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

export default function UploadsPage() {
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

      {/* Center Navbar */}
      <div className="flex justify-center mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md flex overflow-hidden">
          <Link
            href="/home"
            className="px-6 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium flex items-center gap-2"
          >
            <FaYoutube />
            Dashboard
          </Link>
          <Link
            href="/uploads"
            className="px-6 py-3 bg-blue-600 text-white font-medium flex items-center gap-2"
          >
            <FaTable />
            Schedules
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-semibold dark:text-white mb-2">Uploads Management</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your scheduled uploads and view upload history
        </p>
      </div>

      <ClientOnly>
        <div className="flex flex-col gap-8">
          {/* Scheduled Uploads Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <FaCalendarAlt className="text-blue-500" />
                <h2 className="text-xl font-semibold dark:text-white">Scheduled Uploads</h2>
              </div>
              <button
                onClick={handleRefresh}
                className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center gap-2 mb-4">
                <FaHistory className="text-blue-500" />
                <h2 className="text-xl font-semibold dark:text-white">Upload History</h2>
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
                    {logs.map((log) => (
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
          
          {logs && logs.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
              <FaHistory className="text-gray-400 text-3xl mb-2 mx-auto" />
              <h3 className="text-xl font-medium dark:text-white mb-2">No Upload History</h3>
              <p className="text-gray-600 dark:text-gray-400">
                You haven't uploaded any videos yet.
              </p>
            </div>
          )}
        </div>
      </ClientOnly>
    </div>
  );
} 