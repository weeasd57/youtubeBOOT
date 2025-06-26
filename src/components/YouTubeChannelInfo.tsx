'use client';

import { useEffect, useState, useMemo } from 'react';
import { FaYoutube, FaUsers, FaVideo, FaEye, FaSync, FaExclamationTriangle, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import Image from 'next/image';
import { useAccounts } from '@/contexts/AccountContext';
import { useMultiChannel } from '@/contexts/MultiChannelContext';

// Helper function to format numbers
const formatNumber = (num) => {
  if (!num) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// Status indicator component
const StatusIndicator = ({ status, message }) => {
  const statusConfig = {
    connected: {
      icon: FaCheckCircle,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800/30',
      label: 'Connected'
    },
    reauthenticate_required: {
      icon: FaExclamationTriangle,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800/30',
      label: 'Needs Re-authentication'
    },
    error: {
      icon: FaTimesCircle,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800/30',
      label: 'Connection Error'
    },
    loading: {
      icon: FaSync,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800/30',
      label: 'Loading...'
    }
  };

  const config = statusConfig[status] || statusConfig.error;
  const IconComponent = config.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${config.bgColor} ${config.borderColor} border`}>
      <IconComponent className={`${config.color} ${status === 'loading' ? 'animate-spin' : ''}`} size={14} />
      <span className={config.color}>{config.label}</span>
      {message && (
        <span className="text-xs opacity-75">- {message}</span>
      )}
    </div>
  );
};

// Individual channel card component
const ChannelCard = ({ account, channelInfo, loading, error, onRefresh }) => {
  const hasChannelInfo = channelInfo && channelInfo.snippet;
  
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      {/* Header with account info and status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {account.image ? (
            <div className="w-8 h-8 rounded-full overflow-hidden">
              <Image 
                src={account.image} 
                alt={account.name || 'Account'}
                width={32}
                height={32}
                className="w-full h-full object-cover" 
              />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-500 text-white flex items-center justify-center">
              <span className="text-sm font-bold">
                {account.name ? account.name.charAt(0).toUpperCase() : 'A'}
              </span>
            </div>
          )}
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white text-sm">
              {account.name || 'Google Account'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {account.email || 'No email available'}
            </p>
          </div>
        </div>
        
        <button
          onClick={() => onRefresh(account.id)}
          disabled={loading}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Refresh channel info"
        >
          <FaSync className={loading ? 'animate-spin' : ''} size={14} />
        </button>
      </div>

      {/* Status indicator */}
      <div className="mb-3">
        {loading ? (
          <StatusIndicator status="loading" />
        ) : error ? (
          <StatusIndicator status="error" message={error} />
        ) : channelInfo?.status === 'reauthenticate_required' ? (
          <StatusIndicator status="reauthenticate_required" message={channelInfo.message} />
        ) : hasChannelInfo ? (
          <StatusIndicator status="connected" />
        ) : (
          <StatusIndicator status="error" message="No channel data" />
        )}
      </div>

      {/* Channel information */}
      {hasChannelInfo && (
        <div className="space-y-3">
          {/* Channel header */}
          <div className="flex items-center gap-3">
            {channelInfo.snippet.thumbnails?.default?.url && (
              <div className="w-12 h-12 rounded-full overflow-hidden">
                <Image
                  src={channelInfo.snippet.thumbnails.default.url}
                  alt={channelInfo.snippet.title}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <FaYoutube className="text-red-600" size={16} />
                {channelInfo.snippet.title}
              </h4>
              {channelInfo.snippet.customUrl && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  youtube.com/{channelInfo.snippet.customUrl}
                </p>
              )}
            </div>
          </div>

          {/* Channel statistics */}
          {channelInfo.statistics && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
                  <FaUsers size={12} />
                  <span className="text-xs">Subscribers</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatNumber(channelInfo.statistics.subscriberCount)}
                </p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
                  <FaVideo size={12} />
                  <span className="text-xs">Videos</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatNumber(channelInfo.statistics.videoCount)}
                </p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
                  <FaEye size={12} />
                  <span className="text-xs">Views</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatNumber(channelInfo.statistics.viewCount)}
                </p>
              </div>
            </div>
          )}

          {/* Channel description (truncated) */}
          {channelInfo.snippet.description && (
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <p className="line-clamp-2">
                {channelInfo.snippet.description}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="text-center py-4">
          <FaExclamationTriangle className="text-red-500 mx-auto mb-2" size={24} />
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">
            Failed to load channel information
          </p>
          <button
            onClick={() => onRefresh(account.id)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
};

// Main component
export default function YouTubeChannelInfo() {
  const { accounts, loading: accountsLoading } = useAccounts();
  const { 
    channelsInfo, 
    loadingChannels, 
    errors, 
    refreshChannel,
    refreshAllChannels 
  } = useMultiChannel();

  // Memoized channel data for performance
  const channelData = useMemo(() => {
    if (!accounts?.length) return [];
    
    return accounts.map(account => ({
      account,
      channelInfo: channelsInfo[account.id],
      loading: loadingChannels[account.id] || false,
      error: errors[account.id] || null
    }));
  }, [accounts, channelsInfo, loadingChannels, errors]);

  const handleRefresh = (accountId) => {
    refreshChannel(accountId, true);
  };

  const handleRefreshAll = () => {
    refreshAllChannels(true);
  };

  if (accountsLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center">
          <FaSync className="animate-spin text-blue-600 dark:text-blue-400 mr-2" />
          <span className="text-gray-600 dark:text-gray-400">Loading accounts...</span>
        </div>
      </div>
    );
  }

  if (!accounts?.length) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
        <FaYoutube className="text-gray-400 mx-auto mb-3" size={32} />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No YouTube Channels
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Connect your Google accounts to see your YouTube channel information.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <FaYoutube className="text-red-600" />
          YouTube Channels
        </h2>
        <button
          onClick={handleRefreshAll}
          disabled={Object.values(loadingChannels).some(loading => loading)}
          className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          <FaSync className={Object.values(loadingChannels).some(loading => loading) ? 'animate-spin' : ''} size={14} />
          Refresh All
        </button>
      </div>

      {/* Channel cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channelData.map(({ account, channelInfo, loading, error }) => (
          <ChannelCard
            key={account.id}
            account={account}
            channelInfo={channelInfo}
            loading={loading}
            error={error}
            onRefresh={handleRefresh}
          />
        ))}
      </div>
    </div>
  );
}