'use client';

import { createContext, useContext, useState } from 'react';

// Create context
const YouTubeContext = createContext(null);

// Provider component
export function YouTubeProvider({ children }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);
  const [dailyQuotaExceeded, setDailyQuotaExceeded] = useState(false);

  // Mock function for refreshing videos
  const refreshVideos = () => {
    console.log('Mocked refreshVideos function');
    return Promise.resolve([]);
  };

  const value = {
    videos,
    loading,
    error,
    errorType,
    isQuotaError: errorType === 'quota',
    dailyQuotaExceeded,
    refreshVideos,
    clearCache: () => console.log('Mocked clearCache function'),
    resetQuotaExceeded: () => setDailyQuotaExceeded(false)
  };

  return <YouTubeContext.Provider value={value}>{children}</YouTubeContext.Provider>;
}

// Custom hook for using the context
export function useYouTube() {
  const context = useContext(YouTubeContext);
  if (context === null) {
    throw new Error('useYouTube must be used within a YouTubeProvider');
  }
  return context;
} 