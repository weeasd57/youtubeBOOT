'use client';

import { createContext, useContext, useState } from 'react';

// Create context
const YouTubeChannelContext = createContext(null);

// Provider component
export function YouTubeChannelProvider({ children }) {
  const [channelInfo, setChannelInfo] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('unknown');
  const [lastChecked, setLastChecked] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Mock refresh connection function
  const refreshConnection = () => {
    console.log('Mocked refreshConnection function');
    return Promise.resolve();
  };

  // Mock reset cache function
  const resetCache = () => {
    console.log('Mocked resetCache function');
    setChannelInfo(null);
    setLastChecked(null);
  };

  const value = {
    channelInfo,
    connectionStatus,
    lastChecked,
    loading,
    error,
    refreshConnection,
    resetCache
  };

  return <YouTubeChannelContext.Provider value={value}>{children}</YouTubeChannelContext.Provider>;
}

// Custom hook for using the context
export function useYouTubeChannel() {
  const context = useContext(YouTubeChannelContext);
  if (context === null) {
    throw new Error('useYouTubeChannel must be used within a YouTubeChannelProvider');
  }
  return context;
} 