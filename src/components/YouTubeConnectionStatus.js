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
  const getStatusInfo = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          text: 'Connected to YouTube',
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          icon: <FaCheck className="text-green-600" />
        };
      case 'expired':
        return {
          text: 'Authentication Expired',
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
          icon: <FaTimes className="text-orange-600" />
        };
      case 'suspended':
        return {
          text: 'YouTube Account Suspended',
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          icon: <FaExclamationTriangle className="text-red-600" />
        };
      case 'disconnected':
        return {
          text: 'Not Connected',
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          icon: <FaTimes className="text-red-600" />
        };
      case 'error':
        return {
          text: 'Connection Error',
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          icon: <FaTimes className="text-red-600" />
        };
      default:
        return {
          text: 'Checking Connection...',
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          icon: <FaSync className="text-blue-600 animate-spin" />
        };
    }
  };

  const statusInfo = getStatusInfo();

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
              onClick={() => refreshConnection(true)}
              className="p-2 bg-red-100 text-red-600 dark:bg-amber-900/30 dark:text-amber-300 rounded-full hover:bg-red-200 dark:hover:bg-amber-800/40 transition-all duration-300 transform hover:rotate-12"
              disabled={isChecking}
              title="Refresh Connection Status"
            >
              <FaSync className={isChecking ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className={`p-4 ${statusInfo.bgColor} dark:bg-opacity-20 rounded-lg mb-4 border dark:border-amber-800/20`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <YouTubeLogoIcon size={36} className="mr-3" />
              <div>
                <h3 className={`text-lg font-medium ${statusInfo.color}`}>
                  {statusInfo.text}
                </h3>
                {lastChecked ? (
                  <p className="text-sm text-gray-500 dark:text-amber-200/60">
                    Last checked: {formatLastCheckedTime(lastChecked)}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-amber-200/60">
                    Never checked
                  </p>
                )}
              </div>
            </div>
            <div className="text-2xl">
              {statusInfo.icon}
            </div>
          </div>
        </div>

        {/* Debug Information Panel */}
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

        {connectionStatus === 'connected' && channelInfo && (
          <div className="mt-4">
            <h3 className="font-medium text-lg mb-4 dark:text-amber-50">Channel Information</h3>
            
            <div className="flex flex-col md:flex-row gap-4">
              {/* Channel Profile */}
              <div className="flex-1 bg-gray-50 dark:bg-black/60 p-4 rounded-lg border dark:border-amber-700/30 transition-all duration-300">
                <div className="flex items-center gap-4">
                  {channelInfo.thumbnailUrl && (
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border dark:border-amber-500/30">
                      <DriveThumbnail
                        src={channelInfo.thumbnailUrl}
                        alt={channelInfo.channelTitle || 'Channel'}
                        width={64}
                        height={64}
                        fallbackText={channelInfo.channelTitle || 'Y'}
                        className="rounded-full"
                      />
                    </div>
                  )}
                  <div>
                    <h4 className="text-lg font-medium dark:text-amber-50">{channelInfo.channelTitle}</h4>
                    <p className="text-sm text-gray-500 dark:text-amber-200/60">ID: {channelInfo.channelId}</p>
                  </div>
                </div>
                
                {areStatsHidden(channelInfo) && (
                  <div className="mt-3 text-amber-600 dark:text-amber-400 text-sm">
                    <p>Channel statistics may be private or restricted.</p>
                    <p className="mt-1">YouTube API sometimes returns zero counts even when content exists.</p>
                  </div>
                )}
              </div>
              
              {/* Channel Stats */}
              <div className="flex-1 grid grid-cols-3 gap-2">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex flex-col items-center justify-center border dark:border-blue-800/20 transition-all duration-300 hover:-translate-y-1">
                  <FaVideo className="text-blue-500 dark:text-blue-400 text-xl mb-1" />
                  <span className="text-lg font-semibold dark:text-amber-50">
                    {formatNumber(channelInfo.videoCount || channelInfo.statistics?.videoCount)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-amber-200/60">Videos</span>
                  
                  {(channelInfo.videoCount === 0 || channelInfo.statistics?.videoCount === 0) && channelInfo.uploadsPlaylistId && (
                    <a 
                      href={`https://www.youtube.com/playlist?list=${channelInfo.uploadsPlaylistId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 dark:text-amber-400 mt-1 underline"
                    >
                      Check Uploads
                    </a>
                  )}
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg flex flex-col items-center justify-center border dark:border-purple-800/20 transition-all duration-300 hover:-translate-y-1">
                  <FaUsers className="text-purple-500 dark:text-purple-400 text-xl mb-1" />
                  <span className="text-lg font-semibold dark:text-amber-50">
                    {channelInfo.statsHidden ? 'Hidden' : formatNumber(channelInfo.subscriberCount || channelInfo.statistics?.subscriberCount)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-amber-200/60">Subscribers</span>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg flex flex-col items-center justify-center border dark:border-green-800/20 transition-all duration-300 hover:-translate-y-1">
                  <FaEye className="text-green-500 dark:text-green-400 text-xl mb-1" />
                  <span className="text-lg font-semibold dark:text-amber-50">
                    {formatNumber(channelInfo.viewCount || channelInfo.statistics?.viewCount)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-amber-200/60">Views</span>
                </div>
              </div>
            </div>
            
            {channelInfo.uploadsPlaylistId && (
              <div className="mt-4 text-center flex justify-center space-x-3">
                <a 
                  href={`https://www.youtube.com/channel/${channelInfo.channelId}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-all duration-300 transform hover:scale-105 border border-transparent dark:border-amber-500/20"
                >
                  <YouTubeLogoIcon className="text-red-500" />
                  Visit Channel
                </a>
                
                <a 
                  href={`https://www.youtube.com/playlist?list=${channelInfo.uploadsPlaylistId}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-all duration-300 transform hover:scale-105 border border-transparent dark:border-amber-500/20"
                >
                  <FaVideo />
                  View Videos
                </a>
              </div>
            )}
            
            {!channelInfo.uploadsPlaylistId && (
              <div className="mt-4 text-center">
                <a 
                  href={`https://www.youtube.com/channel/${channelInfo.channelId}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-all duration-300 transform hover:scale-105 border border-transparent dark:border-amber-500/20"
                >
                  <YouTubeLogoIcon className="text-red-500" />
                  Visit Channel
                </a>
              </div>
            )}
          </div>
        )}

        {connectionStatus === 'expired' && (
          <div className="mt-4">
            <RefreshButton 
              onSuccess={handleRefreshSuccess}
              className="w-full justify-center"
            />
            <p className="text-sm text-gray-500 dark:text-amber-200/60 mt-2 text-center">
              Click to refresh your YouTube connection
            </p>
          </div>
        )}

        {connectionStatus === 'suspended' && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <FaExclamationTriangle className="text-red-600 text-lg" />
              <h3 className="font-medium text-red-800 dark:text-red-300">YouTube Account Suspended</h3>
            </div>
            <p className="text-sm text-red-600 dark:text-red-300">
              Your YouTube account has been suspended. Please visit the YouTube website to resolve this issue.
            </p>
            <div className="mt-3 flex justify-center">
              <a 
                href="https://support.google.com/youtube/answer/2802168" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-all duration-300"
              >
                <FaYoutube />
                YouTube Help Center
              </a>
            </div>
          </div>
        )}
      </div>

      {showAuthRefresh && session && (
        <div className="mt-2">
          <button
            onClick={refreshAuth}
            disabled={refreshing}
            className="flex items-center gap-2 text-xs px-3 py-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-800/60 text-blue-700 dark:text-blue-300 rounded-md transition-colors"
          >
            {refreshing ? (
              <FaSyncAlt className="animate-spin" />
            ) : (
              <FaHistory />
            )}
            {refreshing ? 'Refreshing...' : 'Refresh Google Authentication'}
          </button>
        </div>
      )}
    </div>
  );
} 