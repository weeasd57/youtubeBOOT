'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaCheck, FaTimes, FaSync, FaVideo, FaEye, FaUsers, FaYoutube, FaGoogle, FaExclamationTriangle, FaHistory, FaSyncAlt, FaBug, FaAngleDown, FaAngleUp } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import Image from "next/image";
import RefreshButton from './RefreshButton';
import { useYouTubeChannel } from '@/contexts/YouTubeChannelContext';
import DriveThumbnail from '@/components/DriveThumbnail';
import { signIn, signOut, useSession } from 'next-auth/react';
import { toastHelper } from './ToastHelper';
import { useAccounts } from '@/contexts/AccountContext';
import { useMultiChannel } from '@/contexts/MultiChannelContext';

const YouTubeLogoIcon = ({ className = "", size = 24 }) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    <Image 
      src="/android-chrome-192x192.png" 
      alt="App Logo"
      fill
      className="object-cover"
    />
  </div>
);

export default function YouTubeConnectionStatus({ onRefreshSuccess, showAuthRefresh = true, showDebug = false }) {
  const { 
    channelInfo, 
    connectionStatus, 
    lastChecked, 
    loading: isChecking, 
    error,
    refreshConnection,
    debugInfo,
    getDebugReport
  } = useYouTubeChannel();
  
  const { accounts, activeAccount, switchAccount } = useAccounts();
  const { channelsInfo, loadingChannels, errors, refreshChannel } = useMultiChannel();
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  
  // إضافة تنقيح لعرض بيانات القناة في الكونسول
  useEffect(() => {
    if (channelInfo) {
      console.log('Channel info in UI component:', {
        id: channelInfo.id,
        title: channelInfo.channelTitle,
        videoCount: channelInfo.videoCount,
        subscriberCount: channelInfo.subscriberCount,
        viewCount: channelInfo.viewCount,
        statistics: channelInfo.statistics,
      });
    }
  }, [channelInfo]);

  // Set the selected account to the active account on component mount
  useEffect(() => {
    if (activeAccount && !selectedAccountId) {
      setSelectedAccountId(activeAccount.id);
    }
  }, [activeAccount, selectedAccountId]);

  // Handle account tab selection
  const handleAccountSelect = (accountId) => {
    setSelectedAccountId(accountId);
    // Don't reload the channel info when selecting a tab
  };

  const { data: session, status } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [debugReport, setDebugReport] = useState(null);

  // Generate debug report when debug panel is opened
  useEffect(() => {
    if (showDebugInfo && getDebugReport) {
      setDebugReport(getDebugReport());
    }
  }, [showDebugInfo, getDebugReport, connectionStatus, error]);

  // Handle refresh success
  const handleRefreshSuccess = () => {
    refreshConnection(true);
    if (onRefreshSuccess) onRefreshSuccess();
  };

  // Format numbers for display
  const formatNumber = (num) => {
    // Handle strings, null, undefined
    if (num === null || num === undefined) return '0';
    
    // Convert to number if it's a string
    const numValue = typeof num === 'string' ? parseInt(num, 10) : num;
    
    // Handle NaN
    if (isNaN(numValue)) return '0';
    
    // Format based on size
    if (numValue >= 1000000) return `${(numValue / 1000000).toFixed(1)}M`;
    if (numValue >= 1000) return `${(numValue / 1000).toFixed(1)}K`;
    return numValue.toString();
  };

  // Check if stats might be hidden
  const areStatsHidden = (info) => {
    if (!info) return false;
    return info.statsHidden === true;
  };

  // Get status information and colors
  const getStatusInfo = (status = connectionStatus) => {
    switch (status) {
      case 'connected':
        return {
          text: 'Connected to YouTube',
          color: 'text-green-600',
          bgColor: 'bg-green-100'
        };
      case 'expired':
        return {
          text: 'Authentication Expired',
          color: 'text-orange-600',
          bgColor: 'bg-orange-100'
        };
      case 'suspended':
        return {
          text: 'YouTube Account Suspended',
          color: 'text-red-600',
          bgColor: 'bg-red-100'
        };
      case 'disconnected':
        return {
          text: 'Not Connected',
          color: 'text-red-600',
          bgColor: 'bg-red-100'
        };
      case 'error':
        return {
          text: 'Connection Error',
          color: 'text-red-600',
          bgColor: 'bg-red-100'
        };
      default:
        return {
          text: 'Checking Connection...',
          color: 'text-blue-600',
          bgColor: 'bg-blue-100'
        };
    }
  };

  // Get status info for selected account
  const statusInfo = selectedAccountId && channelsInfo[selectedAccountId] 
    ? getStatusInfo(channelsInfo[selectedAccountId].status)
    : getStatusInfo();

  const refreshAuth = useCallback(async () => {
    setRefreshing(true);
    toastHelper.info('Refreshing your Google authentication...');
    
    try {
      // Clear any cached data that might be causing issues
      localStorage.removeItem('driveFolders');
      localStorage.removeItem('driveFoldersTimestamp');
      localStorage.removeItem('drive_permission_error');
      
      // Call the refresh API endpoint
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toastHelper.success('Authentication refreshed successfully!');
        // Force a reload to ensure session has updated tokens
        window.location.reload();
      } else {
        // Check if we need to re-authenticate completely
        if (data.needsReauth) {
          toastHelper.warning('Your authentication has expired. Please sign in again.');
          // Redirect to sign in page
          signIn('google', { callbackUrl: window.location.href });
        } else {
          toastHelper.error(`Failed to refresh authentication: ${data.message || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error refreshing authentication:', error);
      toastHelper.error('Failed to refresh authentication. Please try signing out and back in.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const formatLastCheckedTime = (timestamp) => {
    if (!timestamp) return 'Never checked';
    
    try {
      // If it's already a Date object
      if (timestamp instanceof Date) {
        return timestamp.toLocaleTimeString();
      }
      
      // If it's a string, try to convert to Date
      if (typeof timestamp === 'string') {
        return new Date(timestamp).toLocaleTimeString();
      }
      
      // If it's something else, return a fallback
      return 'Unknown time';
    } catch (err) {
      console.error('Error formatting timestamp:', err);
      return 'Unknown time';
    }
  };

  // Format date for debug display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    } catch (err) {
      return 'Invalid date';
    }
  };

  return (
    <div className="flex flex-col w-full">
      <div className="bg-white dark:bg-black rounded-lg shadow-md p-6 border dark:border-amber-700/30 transition-all duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold dark:text-amber-50 flex items-center gap-2">
            <YouTubeLogoIcon className="text-red-500" />
            YouTube Connection Status
          </h2>
          <div className="flex items-center gap-2">
            {(showDebug || process.env.NODE_ENV === 'development') && (
              <button
                onClick={() => setShowDebugInfo(!showDebugInfo)}
                className="p-2 bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700/60 transition-all duration-300"
                title="Toggle Debug Info"
              >
                <FaBug className="text-gray-500 dark:text-gray-400" />
              </button>
            )}
            <button
              onClick={() => {
                if (selectedAccountId) {
                  refreshChannel(selectedAccountId);
                } else {
                  refreshConnection(true);
                }
              }}
              className="p-2 bg-red-100 text-red-600 dark:bg-amber-900/30 dark:text-amber-300 rounded-full hover:bg-red-200 dark:hover:bg-amber-800/40 transition-all duration-300 transform hover:rotate-12"
              disabled={isChecking || (selectedAccountId && loadingChannels[selectedAccountId])}
              title={selectedAccountId ? "Refresh Selected Account Channel Info" : "Refresh Connection Status"}
            >
              <FaSync className={(isChecking || (selectedAccountId && loadingChannels[selectedAccountId])) ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Account tabs */}
        {accounts && accounts.length > 0 && (
          <div className="mb-4 border-b border-amber-200 dark:border-amber-800/30">
            <div className="flex overflow-x-auto">
              {accounts.map(account => (
                <button
                  key={account.id}
                  onClick={() => handleAccountSelect(account.id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    selectedAccountId === account.id 
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
                    <span>{account.name || account.email || 'Account'}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Show selected account info */}
        {selectedAccountId && (
          <div>
            {/* Account info */}
            {accounts && accounts.find(acc => acc.id === selectedAccountId) && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800/30">
                <div className="flex items-center gap-4">
                  {(() => {
                    const account = accounts.find(acc => acc.id === selectedAccountId);
                    return (
                      <>
                        {account.image ? (
                          <div className="w-12 h-12 rounded-full overflow-hidden">
                            <Image 
                              src={account.image} 
                              alt={account.name || 'User'}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover" 
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center">
                            <span className="text-lg font-bold">
                              {account.name ? account.name.charAt(0).toUpperCase() : 'U'}
                            </span>
                          </div>
                        )}
                        <div>
                          <h3 className="font-medium text-lg dark:text-amber-50">
                            {account.name || 'Google Account'}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-amber-200/70">
                            {account.email}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Channel info for selected account */}
            {loadingChannels[selectedAccountId] ? (
              <div className="flex justify-center py-4">
                <FaSync className="animate-spin text-amber-500 w-6 h-6" />
              </div>
            ) : channelsInfo[selectedAccountId] ? (
              <div className={`p-4 ${statusInfo.bgColor} dark:bg-opacity-20 rounded-lg mb-4 border dark:border-amber-800/20`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <YouTubeLogoIcon size={36} className="mr-3" />
                    <div>
                      <h3 className={`text-lg font-medium ${statusInfo.color}`}>
                        {channelsInfo[selectedAccountId].channelTitle || 'YouTube Channel'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Last checked: {formatLastCheckedTime(channelsInfo[selectedAccountId].lastUpdated)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => refreshChannel(selectedAccountId)}
                      className="p-2 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-all duration-300"
                      disabled={loadingChannels[selectedAccountId]}
                      title="Refresh Channel Info"
                    >
                      <FaSync className={loadingChannels[selectedAccountId] ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>
                
                {/* Channel stats */}
                {channelsInfo[selectedAccountId] && !areStatsHidden(channelsInfo[selectedAccountId]) && (
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="p-3 bg-white dark:bg-black/60 rounded-lg border border-gray-200 dark:border-gray-800/30 text-center shadow-sm">
                      <div className="flex justify-center text-blue-500 dark:text-amber-400 mb-1">
                        <FaVideo className="w-5 h-5" />
                      </div>
                      <div className="text-lg font-semibold dark:text-amber-50">
                        {formatNumber(channelsInfo[selectedAccountId].statistics?.videoCount || channelsInfo[selectedAccountId].videoCount)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Videos</div>
                    </div>
                    
                    <div className="p-3 bg-white dark:bg-black/60 rounded-lg border border-gray-200 dark:border-gray-800/30 text-center shadow-sm">
                      <div className="flex justify-center text-blue-500 dark:text-amber-400 mb-1">
                        <FaUsers className="w-5 h-5" />
                      </div>
                      <div className="text-lg font-semibold dark:text-amber-50">
                        {formatNumber(channelsInfo[selectedAccountId].statistics?.subscriberCount || channelsInfo[selectedAccountId].subscriberCount)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Subscribers</div>
                    </div>
                    
                    <div className="p-3 bg-white dark:bg-black/60 rounded-lg border border-gray-200 dark:border-gray-800/30 text-center shadow-sm">
                      <div className="flex justify-center text-blue-500 dark:text-amber-400 mb-1">
                        <FaEye className="w-5 h-5" />
                      </div>
                      <div className="text-lg font-semibold dark:text-amber-50">
                        {formatNumber(channelsInfo[selectedAccountId].statistics?.viewCount || channelsInfo[selectedAccountId].viewCount)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Views</div>
                    </div>
                  </div>
                )}
                
                {/* Hidden stats message */}
                {channelsInfo[selectedAccountId] && areStatsHidden(channelsInfo[selectedAccountId]) && (
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-800/30 text-center">
                    <p className="text-gray-600 dark:text-gray-400">
                      Channel statistics are hidden on this YouTube channel
                    </p>
                  </div>
                )}
                
                {/* Channel actions */}
                <div className="mt-4 flex gap-2">
                  <a
                    href={`https://youtube.com/channel/${channelsInfo[selectedAccountId].channelId || channelsInfo[selectedAccountId].id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 transition-colors"
                  >
                    <FaYoutube /> View Channel
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg mb-4 border border-amber-200 dark:border-amber-800/20 text-center">
                <p className="text-amber-800 dark:text-amber-200">
                  {errors[selectedAccountId] || "No YouTube channel connected to this account"}
                </p>
                <button
                  onClick={() => {
                    // Connect YouTube
                    window.location.href = '/api/auth/youtube';
                  }}
                  className="mt-2 px-3 py-1.5 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 transition-colors mx-auto"
                >
                  <FaYoutube /> Connect YouTube
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/30 text-center">
            <p className="text-red-600 dark:text-red-400">
              {error}
            </p>
            {showAuthRefresh && (
              <button
                onClick={refreshAuth}
                disabled={refreshing}
                className="mt-2 px-3 py-1.5 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 transition-colors mx-auto disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {refreshing ? <FaSync className="animate-spin" /> : <FaGoogle />}
                Refresh Authentication
              </button>
            )}
          </div>
        )}

        {/* Debug info panel */}
        {showDebugInfo && debugReport && (
          <div className="mt-4 mb-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-gray-700 dark:text-amber-200 flex items-center gap-1.5">
                <FaBug />
                Debug Information
              </h3>
              <span className="text-xs bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded">
                Connection Attempts: {debugReport.connectionAttempts}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-600 dark:text-amber-300 mb-1">Current State</h4>
                <div className="bg-white dark:bg-black/40 rounded border border-gray-200 dark:border-gray-700 p-2">
                  <p><span className="font-medium">Status:</span> {debugReport.currentState.connectionStatus}</p>
                  <p><span className="font-medium">Has Channel Info:</span> {debugReport.currentState.hasChannelInfo ? 'Yes' : 'No'}</p>
                  <p><span className="font-medium">Last Checked:</span> {formatDate(debugReport.currentState.lastChecked)}</p>
                  {debugReport.currentState.error && (
                    <p className="text-red-600 dark:text-red-400"><span className="font-medium">Error:</span> {debugReport.currentState.error}</p>
                  )}
                </div>
              </div>
              
              {debugReport.lastError && (
                <div>
                  <h4 className="font-medium text-gray-600 dark:text-amber-300 mb-1">Last Error</h4>
                  <div className="bg-white dark:bg-black/40 rounded border border-red-200 dark:border-red-900/30 p-2 text-red-600 dark:text-red-400">
                    <p><span className="font-medium">Message:</span> {debugReport.lastError.message}</p>
                    <p><span className="font-medium">Time:</span> {formatDate(debugReport.lastError.timestamp)}</p>
                  </div>
                </div>
              )}
            </div>
            
            {debugReport.connectionHistory && debugReport.connectionHistory.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-600 dark:text-amber-300 mb-1">Connection History</h4>
                <div className="bg-white dark:bg-black/40 rounded border border-gray-200 dark:border-gray-700 p-2 max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-1 px-2">Time</th>
                        <th className="text-left py-1 px-2">Status</th>
                        <th className="text-left py-1 px-2">Duration</th>
                        <th className="text-left py-1 px-2">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debugReport.connectionHistory.map((entry, index) => (
                        <tr key={entry.id || index} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-1 px-2">{formatDate(entry.timestamp)}</td>
                          <td className="py-1 px-2">
                            {entry.action ? (
                              <span className="text-blue-600 dark:text-blue-400">{entry.action}</span>
                            ) : entry.success ? (
                              <span className="text-green-600 dark:text-green-400">Success</span>
                            ) : (
                              <span className="text-red-600 dark:text-red-400">Failed</span>
                            )}
                          </td>
                          <td className="py-1 px-2">{entry.duration ? `${entry.duration}ms` : '-'}</td>
                          <td className="py-1 px-2 text-gray-500 dark:text-gray-400">
                            {entry.error || (entry.action ? entry.action : '-')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  console.log('Full debug report:', debugReport);
                  toastHelper.info('Debug report logged to console');
                }}
                className="text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded"
              >
                Log to Console
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 