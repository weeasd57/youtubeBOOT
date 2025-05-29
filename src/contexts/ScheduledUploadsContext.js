'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// Create context
const ScheduledUploadsContext = createContext(null);

// Provider component
export function ScheduledUploadsProvider({ children }) {
  const { data: session, status } = useSession();
  const [scheduledUploads, setScheduledUploads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch scheduled uploads
  const fetchScheduledUploads = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.email) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/scheduled-uploads');
      const data = await response.json();
      
      if (response.ok) {
        setScheduledUploads(data.scheduledUploads || []);
      } else {
        setError(`Failed to fetch scheduled uploads: ${data.error}`);
      }
    } catch (error) {
      console.error('Error fetching scheduled uploads:', error);
      setError(`Error fetching scheduled uploads: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [session, status]);

  // Schedule a new upload
  const scheduleUpload = useCallback(async (uploadData) => {
    if (status !== 'authenticated' || !session?.user?.email) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/schedule-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadData),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Refresh the list of scheduled uploads
        await fetchScheduledUploads();
        return { success: true, data: data.scheduledUpload };
      } else {
        setError(`Failed to schedule upload: ${data.error}`);
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Error scheduling upload:', error);
      setError(`Error scheduling upload: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [session, status, fetchScheduledUploads]);

  // Cancel a scheduled upload
  const cancelScheduledUpload = useCallback(async (id) => {
    if (status !== 'authenticated' || !session?.user?.email) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/scheduled-uploads?id=${id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Refresh the list of scheduled uploads
        await fetchScheduledUploads();
        return { success: true };
      } else {
        setError(`Failed to cancel scheduled upload: ${data.error}`);
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Error cancelling scheduled upload:', error);
      setError(`Error cancelling scheduled upload: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [session, status, fetchScheduledUploads]);

  // Effect for initial data load when session changes
  useEffect(() => {
    if (session?.user?.email) {
      fetchScheduledUploads();
    }
  }, [session?.user?.email, status]); // Use stable dependencies instead of fetchScheduledUploads

  const value = {
    scheduledUploads,
    loading,
    error,
    refreshScheduledUploads: fetchScheduledUploads,
    scheduleUpload,
    cancelScheduledUpload,
  };

  return <ScheduledUploadsContext.Provider value={value}>{children}</ScheduledUploadsContext.Provider>;
}

// Custom hook for using the context
export function useScheduledUploads() {
  const context = useContext(ScheduledUploadsContext);
  if (context === null) {
    throw new Error('useScheduledUploads must be used within a ScheduledUploadsProvider');
  }
  return context;
} 