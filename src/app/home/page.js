'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { FaUpload, FaSync, FaHistory, FaEye, FaThumbsUp, FaCalendarAlt, FaClock, FaCloudUploadAlt, FaTable, FaDownload, FaHashtag, FaTiktok, FaExclamationTriangle } from 'react-icons/fa';
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { DashboardProvider, useDashboard } from '@/contexts/DashboardContext';
import dynamic from 'next/dynamic';
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
import PageContainer from '@/components/PageContainer';
import DriveThumbnail from '@/components/DriveThumbnail';
import FileListItem from '@/components/FileListItem';
import { toast } from 'react-hot-toast';

// Helper function to extract hashtags from text
const extractHashtags = (text) => {
  if (!text) return [];
  
  // Match hashtags (words starting with # followed by letters/numbers)
  const hashtagRegex = /#[a-zA-Z0-9_]+/g;
  const matches = text.match(hashtagRegex) || [];
  
  // Return unique hashtags
  return [...new Set(matches)];
};

// Helper function to generate a clean title from filename
const generateCleanTitle = (fileName) => {
  if (!fileName) return '';
  
  // Remove file extension
  let title = fileName.replace(/\.(mp4|mov|avi|mkv|wmv)$/i, '');
  
  // Remove hashtags
  title = title.replace(/#[a-zA-Z0-9_]+/g, '').trim();
  
  // Replace underscores and hyphens with spaces
  title = title.replace(/[_-]/g, ' ');
  
  // Capitalize first letter of each word
  title = title.replace(/\b\w/g, c => c.toUpperCase());
  
  // Remove any extra spaces
  title = title.replace(/\s+/g, ' ').trim();
  
  return title;
};

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
    <PageContainer 
      user={session?.user} 
      onRefresh={null}
      error={null}
    >
      <HomeDashboard 
        session={session}
        status={status}
      />
    </PageContainer>
  );
}

function HomeDashboard({ session, status }) {
  return (
    <DashboardProvider>
      <HomeDashboardContent session={session} status={status} />
    </DashboardProvider>
  );
}

// Separate component that only renders on the client
function HomeDashboardContent({ session, status }) {
  const {
    authExpired,
    selectedFiles,
    setSelectedFiles,
    error,
    lastChecked,
    activeContentTab,
    activeDriveTab,
    setActiveDriveTab,
    activeDriveAccountId,
    setActiveDriveAccountId,
    userTokens,
    loadingTokens,
    autoUploadEnabled,
    setAutoUploadEnabled,
    selectingAll,
    processingProgress,
    router,
    driveContext,
    drivesInfo,
    loadingDrives,
    driveErrors,
    refreshDrive,
    refreshAllDrives,
    driveFiles,
    driveFolders,
    selectedFolder,
    fetchDriveFiles,
    fetchDriveFolders,
    selectFolder,
    clearSelectedFolder,
    foldersLoading,
    foldersError,
    user,
    userLoading,
    userError,
    accounts,
    channelsInfo,
    loadingChannels,
    channelErrors,
    refreshChannel,
    initialLoading,
    refreshAll,
    tikTokData,
    loadingCombined,
    combinedError,
    handleAccountClick,
    handleRefreshSuccess,
    handleRefreshError,
    syncDriveChanges,
    availableAccounts,
    mergedAccounts,
    filteredItems,
    handleScheduleSelect,
    selectAllFiles,
    handleFolderSelect,
    currentDriveFolders,
  } = useDashboard();

  // Show loading spinner while checking authentication
  if (userLoading || initialLoading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center dark:bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400"></div>
      </div>
    );
  }

  // Check for account availability issues
  const noAccounts = !mergedAccounts || mergedAccounts.length === 0;
  
  // Show user-friendly message if no accounts exist
  if (noAccounts) {
    return (
      <div className="min-h-screen p-8 flex flex-col items-center justify-center text-center dark:bg-black dark:text-white">
        <AppLogoIcon size={64} className="mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No Connected Accounts</h2>
        <p className="mb-4 text-gray-600 dark:text-gray-400">
          Please add a Google Drive account to start uploading and managing your videos.
        </p>
        <button
          onClick={() => router.push('/accounts')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out"
        >
          Add New Account
        </button>
      </div>
    );
  }
  
  // Show a message if there's a user error
  if (userError) {
     return (
       <div className="min-h-screen p-8 flex flex-col items-center justify-center text-center dark:bg-black dark:text-white">
         <AppLogoIcon size={64} className="mb-4" />
         <h2 className="text-2xl font-semibold mb-2">Account Issue</h2>
         <p className="mb-4 text-gray-600 dark:text-gray-400">
           {`Error: ${userError}`}
         </p>
         <button
           onClick={() => router.push('/accounts')}
           className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out"
         >
           Go to Accounts
         </button>
       </div>
     );
  }

  return (
    <div className="min-h-screen p-8 flex flex-col dark:bg-black transition-colors duration-300">
      {/* Auto refresh the token when YouTube auth has expired */}
      {authExpired && <AutoRefresh onSuccess={handleRefreshSuccess} onError={handleRefreshError} />}
      
      {/* Scrollable content area */}
      <div className="mt-4 pb-16">
      <ClientOnly>
        <div className="flex flex-col gap-8 ">
          {/* YouTube Connection Status */}
          <YouTubeConnectionStatus onRefreshSuccess={handleRefreshSuccess} />

          {/* New: Display re-authentication required message for YouTube */}
          {activeDriveAccountId && 
           channelsInfo[activeDriveAccountId]?.status === 'reauthenticate_required' && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800/30">
              <div className="flex items-start gap-2">
                <div className="text-red-600 dark:text-red-400 mt-0.5">
                  <FaExclamationTriangle />
                </div>
                <div>
                  <h4 className="font-medium text-red-700 dark:text-red-400">YouTube Account Disconnected</h4>
                  <p className="text-sm text-red-600 dark:text-red-300">
                    Your YouTube account for {channelsInfo[activeDriveAccountId]?.message || 'this account'} needs to be re-authenticated.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => router.push('/accounts')}
                      className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded"
                    >
                      Reconnect Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Drive Files and Upload Sections */}
          <div className="bg-white dark:bg-black rounded-lg shadow-md p-6 border dark:border-amber-700/30 transition-all duration-300">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold dark:text-amber-50">Manage Content</h2>
                <button
                  onClick={() => {
                    // Reset API call limiters to allow refresh
                    window._lastDriveFoldersApiCall = 0;
                    localStorage.setItem('lastHomeFolderFetch', '0');
                    localStorage.setItem('lastHomeFolderRefresh', '0');
                    
                    syncDriveChanges(true);
                    fetchDriveFolders(true);
                  }}
                  disabled={loadingCombined}
                  className="p-2 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40 border border-blue-200 dark:border-amber-700/30 rounded-full transition-all duration-300"
                  title="Sync with Drive Changes"
                >
                  <FaSync className={foldersLoading ? 'animate-spin' : ''} />
                </button>
            </div>
            
            {/* Account tabs */}
            {availableAccounts && availableAccounts.length > 0 ? (
              <div className="mb-4 border-b border-amber-200 dark:border-amber-800/30">
                <div className="flex overflow-x-auto">
                  {availableAccounts.map(account => (
                    <button
                      key={account.id}
                      onClick={() => {
                        console.log('Account tab clicked:', account.id);
                        setActiveDriveTab(account.id);
                        
                        if (account.id !== activeDriveAccountId) {
                          // This will trigger the useEffect to fetch new Drive and YouTube data
                          setActiveDriveAccountId(account.id); 
                        } else {
                          // If it's the same account, just do a manual refresh
                          console.log('Refreshing data for currently active account');
                          if (refreshDrive) refreshDrive(account.id);
                          if (refreshChannel) refreshChannel(account.id);
                        }
                      }}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeDriveTab === account.id 
                          ? 'border-amber-500 text-amber-600 dark:text-amber-400' 
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {account.image ? (
                          <div className="w-6 h-6 rounded-full overflow-hidden">
                            <Image 
                              src={account.image} 
                              alt={account.name || 'User'}
                              width={24}
                              height={24}
                              className="w-full h-full object-cover" 
                            />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center">
                            <span className="text-xs font-bold">
                              {account.name ? account.name.charAt(0).toUpperCase() : 'U'}
                            </span>
                          </div>
                        )}
                        <div className={`${!account?.email ? 'account-incomplete' : ''}`}>
                          <h3 className="font-medium dark:text-amber-50">
                            {account?.name || 'Google Account'}
                          </h3>
                          <p className={`text-sm ${!account?.email ? 'account-email-placeholder' : 'text-gray-600 dark:text-amber-200/70'}`}>
                            {account?.email || `Email not available (ID: ${account?.id?.substring(0, 8)}...)`}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 text-center bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                <p className="text-amber-800 dark:text-amber-200">No accounts available</p>
              </div>
            )}
          
            {/* Last sync info */}
            {lastChecked && (
              <p className="text-xs text-gray-500 dark:text-amber-400/60 mb-4 text-right">
                Last synced: {new Date(lastChecked).toLocaleTimeString()}
              </p>
            )}
            
            {/* Content tabs - only show Schedule Uploads tab */}
            <div className="flex border-b border-amber-200 dark:border-amber-800/30 mb-4">
              <button
                className="px-4 py-2.5 border-b-2 font-medium transition-colors border-amber-500 text-amber-600 dark:text-amber-400"
              >
                <span className="flex items-center gap-2">
                  <FaCalendarAlt className="text-amber-500" />
                  Schedule Uploads
                </span>
              </button>
            </div>
            
            {/* Full width layout */}
            <div className="w-full">
              {/* Show content for selected drive account */}
              {activeDriveAccountId ? (
                <>
                  {/* Drive account info */}
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800/30">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        {(() => {
                          // Try to find the account in available accounts
                          const account = availableAccounts?.find?.(acc => acc.id === activeDriveAccountId) || 
                                         accounts?.find?.(acc => acc.id === activeDriveAccountId) || 
                                         { id: activeDriveAccountId };
                          return (
                            <>
                              {account?.image ? (
                                <div className="w-10 h-10 rounded-full overflow-hidden">
                                  <Image 
                                    src={account.image} 
                                    alt={account.name || 'User'}
                                    width={40}
                                    height={40}
                                    className="w-full h-full object-cover" 
                                  />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center">
                                  <span className="text-sm font-bold">
                                    {account?.name ? account.name.charAt(0).toUpperCase() : 'U'}
                                  </span>
                                </div>
                              )}
                              <div className={`${!account?.email ? 'account-incomplete' : ''}`}>
                                <h3 className="font-medium dark:text-amber-50">
                                  {account?.name || 'Google Account'}
                                </h3>
                                <p className={`text-sm ${!account?.email ? 'account-email-placeholder' : 'text-gray-600 dark:text-amber-200/70'}`}>
                                  {account?.email || `Email not available (ID: ${account?.id?.substring(0, 8)}...)`}
                                </p>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      
                      {/* Add refresh button */}
                      <button
                        onClick={() => {
                          console.log('Refreshing Drive data for selected account');
                          refreshDrive(activeDriveAccountId);
                        }}
                        className="p-2 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40 border border-blue-200 dark:border-amber-700/30 rounded-full transition-all duration-300"
                      >
                        <FaSync className={loadingDrives[activeDriveAccountId] ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>

                  {/* إضافة عنصر جديد لعرض أخطاء تبديل الحساب */}
                  {driveErrors[activeDriveAccountId] && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800/30">
                      <div className="flex items-start gap-2">
                        <div className="text-red-600 dark:text-red-400 mt-0.5">
                          <FaExclamationTriangle />
                        </div>
                        <div>
                          <h4 className="font-medium text-red-700 dark:text-red-400">Drive Error</h4>
                          <p className="text-sm text-red-600 dark:text-red-300">
                            {typeof driveErrors[activeDriveAccountId] === 'string' ? driveErrors[activeDriveAccountId] : 'Error loading Drive data. Try refreshing or signing in again.'}
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => refreshDrive(activeDriveAccountId)}
                              className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded"
                            >
                              Retry
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Show loading indicator when folders are loading */}
                  {loadingDrives[activeDriveAccountId] && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800/30 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600 dark:border-blue-400"></div>
                        <p className="text-blue-700 dark:text-blue-400">Loading Drive data...</p>
                      </div>
                    </div>
                  )}

                  {/* Drive Files Column - full width */}
                  <div className="w-full mb-6">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-medium text-black dark:text-amber-50">Your Drive Videos</h3>
                      {filteredItems.length > 0 && (
                        <button 
                          onClick={selectAllFiles}
                          disabled={selectingAll}
                          className={`text-xs px-2 py-1 ${selectingAll ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-gray-100 hover:bg-gray-200 dark:bg-black/60 dark:hover:bg-black/80'} text-black dark:text-amber-200/70 rounded border border-amber-200 dark:border-amber-700/30 flex items-center gap-1`}
                        >
                          {selectingAll ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-amber-500"></div>
                              <span>Processing... {processingProgress}%</span>
                            </>
                          ) : (
                            selectedFiles.length === filteredItems.length ? 'Deselect All' : `Select All (${filteredItems.length})`
                          )}
                        </button>
                      )}
                    </div>

                    {/* Add folder filter dropdown */}
                    <div className="mb-3 w-full">
                      <select
                        value={selectedFolder ? selectedFolder.id : 'all'} 
                        onChange={handleFolderSelect}
                        className="w-full p-2 text-sm border border-amber-200 dark:border-amber-700/30 rounded-lg bg-white dark:bg-black text-black dark:text-amber-50"
                      >
                        <option value="all">All Folders</option>
                        {(currentDriveFolders.length > 0 ? currentDriveFolders : driveFolders).map(folder => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                      
                      {/* إضافة زر تحديث للمجلدات */}
                      {foldersLoading && (
                        <div className="mt-1 text-xs text-amber-500 dark:text-amber-400 flex items-center">
                          <FaSync className="animate-spin mr-1" size={10} />
                          <span>Refreshing folders...</span>
                        </div>
                      )}
                    </div>

                    {/* قائمة الفيديوهات بشكل شبكة */}
                    <div className="overflow-y-auto max-h-[500px] w-full rounded-lg bg-white/50 dark:bg-black shadow-inner border border-amber-200 dark:border-amber-700/20 transition-all duration-300">
                      {driveFiles.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-3">
                          {filteredItems.map((file) => (
                            <div
                              key={file.id}
                              className={`w-full h-full transition-all duration-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/20 p-3 rounded-lg border ${
                                selectedFiles.some(f => f.id === file.id)
                                ? 'border-amber-500 bg-amber-50/30 dark:bg-amber-900/20'
                                : 'border-transparent'
                              }`}
                              onClick={() => handleScheduleSelect(file)}
                            >
                              <div className="flex flex-col h-full">
                                <div className="absolute top-2 left-2">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedFiles.some(f => f.id === file.id)}
                                    onChange={() => handleScheduleSelect(file)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 text-amber-600"
                                  />
                                </div>
                                <FileListItem 
                                  file={file}
                                  onSchedule={() => handleScheduleSelect(file)}
                                  className="w-full h-full"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                          {loadingCombined ? (
                            <div className="flex justify-center">
                              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-amber-500"></div>
                            </div>
                          ) : (
                            <p>No videos found in your Drive</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Upload Form - full width */}
                  <div className="w-full">
                    {selectedFiles.length > 0 ? (
                      <>
                        {selectingAll ? (
                          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/30 text-center">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
                              <p className="text-amber-700 dark:text-amber-300">Preparing {selectedFiles.length} videos for scheduling...</p>
                              <div className="w-full max-w-md h-2 bg-amber-200 dark:bg-amber-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-amber-500 transition-all duration-300" 
                                  style={{ width: `${processingProgress}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-amber-600 dark:text-amber-400">{processingProgress}% complete</p>
                            </div>
                          </div>
                        ) : (
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
                        )}
                      </>
                    ) : (
                      <>
                        <h3 className="text-lg font-medium text-black dark:text-amber-50 mb-3">Schedule Selected Videos</h3>
                        <p className="text-black dark:text-amber-200/60">
                          Select videos from the list to schedule them for upload.
                        </p>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 text-center bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                  <p className="text-amber-800 dark:text-amber-200">No accounts available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </ClientOnly>
      </div>
    </div>
  );
}