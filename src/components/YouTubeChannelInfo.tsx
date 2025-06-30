'use client';

import { useEffect, useState, useMemo } from 'react';
import { FaYoutube, FaUsers, FaVideo, FaEye, FaSync, FaExclamationTriangle, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import Image from 'next/image';
import { useAccounts } from '@/contexts/AccountContext.tsx';
import { useMultiChannel } from '@/contexts/MultiChannelContext';
import YouTubeAuthErrorBanner from './YouTubeAuthErrorBanner';
import Link from 'next/link';

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
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 flex flex-col h-full">
      {/* Header with account info and status */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {account.image ? (
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
              <Image 
                src={account.image} 
                alt={account.name || 'Account'}
                width={40}
                height={40}
                className="w-full h-full object-cover" 
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold">
                {account.name ? account.name.charAt(0).toUpperCase() : 'A'}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white text-base truncate">
              {account.name || 'Google Account'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {account.email || 'No email available'}
            </p>
          </div>
        </div>
        
        <button
          onClick={() => onRefresh(account.id)}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
          title="Refresh channel info"
        >
          <FaSync className={loading ? 'animate-spin' : ''} size={16} />
        </button>
      </div>

      {/* Status indicator */}
      <div className="mb-4">
        {loading ? (
          <StatusIndicator status="loading" message={null} />
        ) : error ? (
          <>
            <StatusIndicator status="error" message={error} />
            <YouTubeAuthErrorBanner
              accountId={account.id}
              message={error}
              needsReconnect={channelInfo?.status === 'reauthenticate_required'}
              onRetry={onRefresh}
            />
          </>
        ) : channelInfo?.status === 'reauthenticate_required' ? (
          <>
            <StatusIndicator status="reauthenticate_required" message={channelInfo.message} />
            <YouTubeAuthErrorBanner
              accountId={account.id}
              message={channelInfo.message}
              needsReconnect={true}
              onRetry={onRefresh}
            />
          </>
        ) : hasChannelInfo ? (
          <StatusIndicator status="connected" message={null} />
        ) : (
          <>
            <StatusIndicator status="error" message="No channel data" />
            <YouTubeAuthErrorBanner
              accountId={account.id}
              message="No channel data or initial connection error. Please try reconnecting."
              needsReconnect={true}
              onRetry={onRefresh}
            />
          </>
        )}
      </div>

      {/* Channel information */}
      {hasChannelInfo && (
        <div className="space-y-4 flex-grow">
          {/* Channel header */}
          <div className="flex items-center gap-4">
            {channelInfo.snippet.thumbnails?.default?.url && (
              <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                <Image
                  src={channelInfo.snippet.thumbnails.default.url}
                  alt={channelInfo.snippet.title}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2 mb-1 truncate">
                <FaYoutube className="text-red-600" size={20} />
                {channelInfo.snippet.title}
              </h4>
              {channelInfo.snippet.customUrl && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  youtube.com/{channelInfo.snippet.customUrl}
                </p>
              )}
            </div>
          </div>

          {/* Channel statistics */}
          {channelInfo.statistics && (
            <div className="grid grid-cols-3 gap-4 text-center border-t border-b border-gray-100 dark:border-gray-800 py-3">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
                  <FaUsers size={14} />
                  <span className="text-xs font-medium">Subscribers</span>
                </div>
                <p className="text-base font-bold text-gray-900 dark:text-white">
                  {formatNumber(channelInfo.statistics.subscriberCount)}
                </p>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
                  <FaVideo size={14} />
                  <span className="text-xs font-medium">Videos</span>
                </div>
                <p className="text-base font-bold text-gray-900 dark:text-white">
                  {formatNumber(channelInfo.statistics.videoCount)}
                </p>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
                  <FaEye size={14} />
                  <span className="text-xs font-medium">Views</span>
                </div>
                <p className="text-base font-bold text-gray-900 dark:text-white">
                  {formatNumber(channelInfo.statistics.viewCount)}
                </p>
              </div>
            </div>
          )}

          {/* Channel description (truncated) */}
          {channelInfo.snippet.description && (
            <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              <p className="line-clamp-3">
                {channelInfo.snippet.description}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {error && !loading && channelInfo?.status !== 'reauthenticate_required' && (
        null // Render nothing here as banner handles it
      )}
    </div>
  );
};

// Main component
export default function YouTubeChannelInfo() {
  const { accounts = [], loading: accountsLoading } = useAccounts();
  const { 
    channelsInfo, 
    loadingChannels, 
    errors, 
    refreshChannel,
    refreshAllChannels 
  } = useMultiChannel();

  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Memoized channel data for performance
  const channelData = useMemo(() => {
    if (accounts.length === 0) {
      return [];
    }
    
    const data = accounts.map(account => ({
      account,
      channelInfo: channelsInfo[account.id],
      loading: loadingChannels[account.id] || false,
      error: errors[account.id] || null
    }));

    // Set initial active tab if not already set
    if (activeTab === null && data.length > 0) {
      setActiveTab(data[0].account.id);
    }

    return data;
  }, [accounts, channelsInfo, loadingChannels, errors, activeTab]);

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

  const currentChannelData = activeTab ? channelData.find(d => d.account.id === activeTab) : null;

  return (
    <div className="bg-white dark:bg-gray-950 p-4 sm:p-6 md:p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <FaYoutube className="text-red-600" /> YouTube Channels
        </h2>
        <button
          onClick={handleRefreshAll}
          disabled={accountsLoading || Object.values(loadingChannels).some(Boolean)}
          className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-base md:text-lg shadow-md"
        >
          <FaSync className={accountsLoading || Object.values(loadingChannels).some(Boolean) ? 'animate-spin' : ''} size={18} />
          Refresh All
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">No YouTube accounts connected.</p>
          <p className="text-gray-500 dark:text-gray-500 text-sm">Connect an account to manage your YouTube channels.</p>
          <Link href="/accounts" className="mt-6 inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-md">
            <FaYoutube className="mr-2" /> Add YouTube Account
          </Link>
        </div>
      ) : (
        <>
          {/* Tabs for channels */}
          <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
            {channelData.map((data) => (
              <button
                key={data.account.id}
                onClick={() => setActiveTab(data.account.id)}
                className={`py-2 px-4 text-sm font-medium rounded-t-lg transition-colors duration-200
                  ${activeTab === data.account.id
                    ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                {data.account.name || 'Unknown Channel'}
              </button>
            ))}
          </div>

          {/* Display current active channel */}
          {currentChannelData && (
            <div className="mt-4">
              <ChannelCard
                key={currentChannelData.account.id}
                account={currentChannelData.account}
                channelInfo={currentChannelData.channelInfo}
                loading={currentChannelData.loading}
                error={currentChannelData.error}
                onRefresh={handleRefresh}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}