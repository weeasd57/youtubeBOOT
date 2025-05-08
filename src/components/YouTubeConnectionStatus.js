'use client';

import { FaYoutube, FaCheck, FaTimes, FaSync, FaVideo, FaEye, FaUsers } from 'react-icons/fa';
import Image from 'next/image';
import RefreshButton from './RefreshButton';
import { useYouTubeChannel } from '@/contexts/YouTubeChannelContext';

export default function YouTubeConnectionStatus({ onRefreshSuccess }) {
  const { 
    channelInfo, 
    connectionStatus, 
    lastChecked, 
    loading: isChecking, 
    error,
    refreshConnection
  } = useYouTubeChannel();

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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold dark:text-white flex items-center gap-2">
          <FaYoutube className="text-red-500" />
          YouTube Connection Status
        </h2>
        <button
          onClick={() => refreshConnection(true)}
          className="p-2 bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300 rounded-full hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
          disabled={isChecking}
          title="Refresh Connection Status"
        >
          <FaSync className={isChecking ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className={`p-4 ${statusInfo.bgColor} dark:bg-opacity-20 rounded-lg mb-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FaYoutube className="text-red-600 text-4xl mr-3" />
            <div>
              <h3 className={`text-lg font-medium ${statusInfo.color}`}>
                {statusInfo.text}
              </h3>
              {lastChecked && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
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
          <h3 className="font-medium text-lg mb-4 dark:text-white">Channel Information</h3>
          
          <div className="flex flex-col md:flex-row gap-4">
            {/* Channel Profile */}
            <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <div className="flex items-center gap-4">
                {channelInfo.thumbnailUrl && (
                  <div className="relative w-16 h-16 rounded-full overflow-hidden">
                    <Image
                      src={channelInfo.thumbnailUrl}
                      alt={channelInfo.channelTitle || 'Channel'}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        // If the image fails to load, show a fallback
                        e.target.style.display = 'none';
                        e.target.parentElement.style.backgroundColor = '#f44336';
                        e.target.parentElement.innerHTML = '<div class="flex items-center justify-center h-full w-full text-white text-lg font-bold">' + 
                          (channelInfo.channelTitle?.[0] || 'Y') + '</div>';
                      }}
                    />
                  </div>
                )}
                <div>
                  <h4 className="text-lg font-medium dark:text-white">{channelInfo.channelTitle}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">ID: {channelInfo.channelId}</p>
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
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex flex-col items-center justify-center">
                <FaVideo className="text-blue-500 text-xl mb-1" />
                <span className="text-lg font-semibold dark:text-white">
                  {formatNumber(channelInfo.videoCount)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Videos</span>
                
                {channelInfo.videoCount === 0 && channelInfo.uploadsPlaylistId && (
                  <a 
                    href={`https://www.youtube.com/playlist?list=${channelInfo.uploadsPlaylistId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 mt-1 underline"
                  >
                    Check Uploads
                  </a>
                )}
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg flex flex-col items-center justify-center">
                <FaUsers className="text-purple-500 text-xl mb-1" />
                <span className="text-lg font-semibold dark:text-white">
                  {channelInfo.statsHidden ? 'Hidden' : formatNumber(channelInfo.subscriberCount)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Subscribers</span>
              </div>
              
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg flex flex-col items-center justify-center">
                <FaEye className="text-green-500 text-xl mb-1" />
                <span className="text-lg font-semibold dark:text-white">
                  {formatNumber(channelInfo.viewCount)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Views</span>
              </div>
            </div>
          </div>
          
          {channelInfo.uploadsPlaylistId && (
            <div className="mt-4 text-center flex justify-center space-x-3">
              <a 
                href={`https://www.youtube.com/channel/${channelInfo.channelId}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
              >
                <FaYoutube />
                Visit Channel
              </a>
              
              <a 
                href={`https://www.youtube.com/playlist?list=${channelInfo.uploadsPlaylistId}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
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
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
              >
                <FaYoutube />
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
            Click to refresh your YouTube connection
          </p>
        </div>
      )}
    </div>
  );
} 