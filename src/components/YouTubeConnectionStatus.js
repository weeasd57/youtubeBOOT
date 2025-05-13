'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaCheck, FaTimes, FaSync, FaVideo, FaEye, FaUsers, FaYoutube, FaGoogle, FaExclamationTriangle, FaHistory, FaSyncAlt } from 'react-icons/fa';
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

export default function YouTubeConnectionStatus({ onRefreshSuccess, showAuthRefresh = true }) {
  const { 
    channelInfo, 
    connectionStatus, 
    lastChecked, 
    loading: isChecking, 
    error,
    refreshConnection
  } = useYouTubeChannel();
  const { data: session, status } = useSession();
  const [refreshing, setRefreshing] = useState(false);

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
    return info.statsHidden === true || 
           (info.subscriberCount === 0 && info.viewCount === 0 && info.videoCount === 0);
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

  return (
    <div className="flex flex-col w-full">
      <div className="bg-white dark:bg-black rounded-lg shadow-md p-6 border dark:border-amber-700/30 transition-all duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold dark:text-amber-50 flex items-center gap-2">
            <YouTubeLogoIcon className="text-red-500" />
            YouTube Connection Status
          </h2>
          <button
            onClick={() => refreshConnection(true)}
            className="p-2 bg-red-100 text-red-600 dark:bg-amber-900/30 dark:text-amber-300 rounded-full hover:bg-red-200 dark:hover:bg-amber-800/40 transition-all duration-300 transform hover:rotate-12"
            disabled={isChecking}
            title="Refresh Connection Status"
          >
            <FaSync className={isChecking ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className={`p-4 ${statusInfo.bgColor} dark:bg-opacity-20 rounded-lg mb-4 border dark:border-amber-800/20`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <YouTubeLogoIcon size={36} className="mr-3" />
              <div>
                <h3 className={`text-lg font-medium ${statusInfo.color}`}>
                  {statusInfo.text}
                </h3>
                {lastChecked && (
                  <p className="text-sm text-gray-500 dark:text-amber-200/60">
                    Last checked: {lastChecked.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
            <div className="text-2xl">
              {statusInfo.icon}
            </div>
          </div>
        </div>

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
                    {formatNumber(channelInfo.videoCount)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-amber-200/60">Videos</span>
                  
                  {channelInfo.videoCount === 0 && channelInfo.uploadsPlaylistId && (
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
                    {channelInfo.statsHidden ? 'Hidden' : formatNumber(channelInfo.subscriberCount)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-amber-200/60">Subscribers</span>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg flex flex-col items-center justify-center border dark:border-green-800/20 transition-all duration-300 hover:-translate-y-1">
                  <FaEye className="text-green-500 dark:text-green-400 text-xl mb-1" />
                  <span className="text-lg font-semibold dark:text-amber-50">
                    {formatNumber(channelInfo.viewCount)}
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