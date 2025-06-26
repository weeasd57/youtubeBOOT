'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { FaUpload, FaSync, FaHistory, FaCalendarAlt, FaTable, FaClock, FaSpinner, FaVideo } from 'react-icons/fa';
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { useUploadLogs } from '@/contexts/UploadLogsContext';
import { useScheduledUploads } from '@/contexts/ScheduledUploadsContext';
import ClientOnly from '@/components/ClientOnly';
import ThemeToggle from '@/components/ThemeToggle';
import ScheduledUploadList from '@/components/ScheduledUploadList';
import Link from 'next/link';
import { useDrive } from '@/contexts/MultiDriveContext';
import ScheduleUploadForm from '@/components/ScheduleUploadForm';
import PageContainer from '@/components/PageContainer';
import QueueDataTable from '@/components/QueueDataTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { sanitizeInput, validateInput, logSecurityEvent, RateLimiter } from '@/utils/security';
import SecurityDashboard from '@/components/SecurityDashboard';

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

// إنشاء rate limiter للصفحة
const pageRateLimiter = new RateLimiter(60 * 1000, 30); // 30 requests per minute

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
  const [activeTab, setActiveTab] = useState('scheduled');
  const [securityError, setSecurityError] = useState(null);


  // بعد حذف useDataFetching، لازم نعدل حالة التحميل والتحديث
  // لو فيه دوال refreshAll أو initialLoading في سياق تاني، استخدمهم، لو لأ، خليهم دوال فاضية/ثوابت
  const initialLoading = false;
  const refreshAll = () => {};
  const dataLoading = false;

  // Combined loading state
  const loadingCombined = userLoading || logsLoading || dataLoading;

  // Redirect to landing page if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', { 
        page: '/uploads',
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown'
      });
      router.push('/');
    }
  }, [status, router]);

  // تسجيل دخول المستخدم للصفحة
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      const userIdentifier = session.user.email;
      
      // التحقق من rate limiting
      if (!pageRateLimiter.isAllowed(userIdentifier)) {
        setSecurityError('Too many requests. Please wait before refreshing.');
        logSecurityEvent('RATE_LIMIT_EXCEEDED', { 
          userEmail: userIdentifier,
          page: '/uploads',
          remainingRequests: pageRateLimiter.getRemainingRequests(userIdentifier)
        });
        return;
      }
      
      logSecurityEvent('PAGE_ACCESS', { 
        page: '/uploads',
        userEmail: userIdentifier,
        remainingRequests: pageRateLimiter.getRemainingRequests(userIdentifier)
      });
    }
  }, [status, session?.user?.email]);

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

  // Handle refresh with security checks
  const handleRefresh = () => {
    try {
      if (!session?.user?.email) {
        logSecurityEvent('REFRESH_WITHOUT_AUTH', { page: '/uploads' });
        return;
      }

      const userIdentifier = session.user.email;
      
      // التحقق من rate limiting للتحديث
      if (!pageRateLimiter.isAllowed(userIdentifier)) {
        setSecurityError('Too many refresh requests. Please wait before trying again.');
        logSecurityEvent('REFRESH_RATE_LIMIT_EXCEEDED', { 
          userEmail: userIdentifier,
          remainingRequests: pageRateLimiter.getRemainingRequests(userIdentifier)
        });
        return;
      }

      setSecurityError(null);
      refreshScheduledUploads();
      refreshAll(true);
      
      logSecurityEvent('PAGE_REFRESH', { 
        userEmail: userIdentifier,
        page: '/uploads'
      });
      
    } catch (error) {
      console.error('Error during refresh:', error);
      setSecurityError('An error occurred while refreshing. Please try again.');
      logSecurityEvent('REFRESH_ERROR', { 
        error: error.message,
        page: '/uploads'
      });
    }
  };

  // Show loading spinner while checking authentication
  if (status === 'loading') {
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
            Manage your scheduled uploads, video queue and view upload history
          </p>
          
          {/* Security Error Display */}
          {securityError && (
            <div className="mt-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-md text-sm animate-pulse">
              <div className="flex items-center">
                <FaClock className="mr-2" />
                <span>{securityError}</span>
              </div>
            </div>
          )}
        </div>

        <Tabs defaultValue="scheduled" className="w-full mb-6" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scheduled">Scheduled Uploads</TabsTrigger>
            <TabsTrigger value="history">Upload History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="scheduled" className="pt-4">
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
            
            {/* Create New Schedule Button */}
            <div className="flex justify-center sm:justify-end mt-6">
              <Link
                href="/home?tab=schedule"
                className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-center rounded-md flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-300 transform hover:translate-y-[-2px] border border-transparent dark:border-amber-500/20"
              >
                <FaCalendarAlt />
                Schedule New Uploads
              </Link>
            </div>
          </TabsContent>
          
          
          <TabsContent value="history" className="pt-4">
            {logs && logs.length > 0 ? (
              <div className="bg-white dark:bg-black rounded-lg shadow-md p-4 sm:p-6 border dark:border-amber-700/30 transition-all duration-300">
                <div className="flex items-center gap-2 mb-4">
                  <FaHistory className="text-amber-500" />
                  <h2 className="text-xl font-semibold dark:text-amber-50">Upload History</h2>
                </div>
                
                <div className="w-full overflow-hidden">
                  <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-amber-800/30">
                    <thead className="bg-gray-50 dark:bg-black/50">
                      <tr>
                        <th className="w-[20%] px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-amber-300 uppercase tracking-wider">Date</th>
                        <th className="w-[30%] px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-amber-300 uppercase tracking-wider">File</th>
                        <th className="w-[30%] px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-amber-300 uppercase tracking-wider">Title</th>
                        <th className="w-[20%] px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-amber-300 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-black divide-y divide-gray-200 dark:divide-amber-800/20">
                      {logs.map((log) => (
                        <tr key={log.id} className="transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-black/40">
                          <td className="w-[20%] px-2 py-3 text-xs sm:text-sm text-gray-500 dark:text-amber-200/70 break-words">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="w-[30%] px-2 py-3 text-xs sm:text-sm text-gray-900 dark:text-amber-50 break-words">
                            {sanitizeInput.html(log.file_name || 'Unknown file')}
                          </td>
                          <td className="w-[30%] px-2 py-3 text-xs sm:text-sm text-gray-900 dark:text-amber-50 break-words">
                            {sanitizeInput.html(log.title || 'No title')}
                          </td>
                          <td className="w-[20%] px-2 py-3 text-center sm:text-left">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              log.status === 'success'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                            }`}>
                              {log.status === 'success' ? 'Success' : 'Failed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-black rounded-lg shadow-md p-8 text-center border dark:border-amber-700/30 transition-all duration-300">
                <FaHistory className="text-amber-500 mx-auto mb-2" size={24} />
                <h3 className="text-lg font-medium dark:text-amber-50">No Upload History</h3>
                <p className="text-gray-600 dark:text-amber-200/60 mt-2">
                  Your upload history will appear here once you've uploaded videos.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Security Dashboard - يظهر للمستخدمين المخولين */}
      <SecurityDashboard isAdmin={user?.email && isAdminUser(user.email)} />
    </PageContainer>
  );
}

// دالة للتحقق من صلاحيات الإدارة
function isAdminUser(email) {
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
  return adminEmails.includes(email);
} 