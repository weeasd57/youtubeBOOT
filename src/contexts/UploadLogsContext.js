'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// Create context
const UploadLogsContext = createContext(null);

// Provider component
export function UploadLogsProvider({ children }) {
  const { data: session, status } = useSession();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch upload logs
  const fetchLogs = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.email) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/upload-logs');
      const data = await response.json();
      
      if (response.ok) {
        setLogs(data.logs || []);
      } else {
        setError(`Failed to fetch upload logs: ${data.error}`);
      }
    } catch (error) {
      console.error('Error fetching upload logs:', error);
      setError(`Error fetching upload logs: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [session, status]);

  // Effect for initial data load when session changes
  useEffect(() => {
    if (session?.user?.email) {
      fetchLogs();
    }
  }, [session, fetchLogs]);

  const value = {
    logs,
    loading,
    error,
    refreshLogs: fetchLogs,
  };

  return <UploadLogsContext.Provider value={value}>{children}</UploadLogsContext.Provider>;
}

// Custom hook for using the context
export function useUploadLogs() {
  const context = useContext(UploadLogsContext);
  if (context === null) {
    throw new Error('useUploadLogs must be used within an UploadLogsProvider');
  }
  return context;
} 