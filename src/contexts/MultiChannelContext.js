import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAccounts } from './AccountContext';

// Create context
const MultiChannelContext = createContext();

export function MultiChannelProvider({ children }) {
  const [channelsInfo, setChannelsInfo] = useState({});
  const [loadingChannels, setLoadingChannels] = useState({});
  const [errors, setErrors] = useState({});
  const { accounts } = useAccounts();

  // Minimum interval between fetches per account (5 minutes)
  const MIN_FETCH_INTERVAL = 5 * 60 * 1000;
  const lastFetchedRef = useRef({});
  // Track pending fetch promises to avoid duplicate requests
  const pendingFetches = useRef(new Map());

  // Fetch channel info for a specific account
  const fetchChannelInfo = useCallback(async (accountId, force = false) => {
    if (!accountId) return;

    // If a fetch is already in progress for this account, return the same promise
    if (!force && pendingFetches.current.has(accountId)) {
      return pendingFetches.current.get(accountId);
    }

    // Throttle repeated calls unless force is true
    const lastFetched = lastFetchedRef.current[accountId] || 0;
    if (!force && Date.now() - lastFetched < MIN_FETCH_INTERVAL) {
      return;
    }

    // Mark the start time immediately to avoid parallel throttled calls
    lastFetchedRef.current[accountId] = Date.now();

    setLoadingChannels(prev => ({ ...prev, [accountId]: true }));
    setErrors(prev => ({ ...prev, [accountId]: null }));

    const fetchPromise = (async () => {
      try {
        console.log(`Fetching channel info for account: ${accountId}`);
        const response = await fetch(`/api/youtube/account-channel-info?accountId=${accountId}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`Channel info response for account ${accountId}:`, data);
          
          if (data.success && data.channelInfo) {
            setChannelsInfo(prev => ({ 
              ...prev, 
              [accountId]: {
                ...data.channelInfo,
                status: data.status,
                lastUpdated: new Date().toISOString()
              }
            }));
          } else {
            // Clear existing data if the request was successful but returned no channel info
            setChannelsInfo(prev => ({
              ...prev,
              [accountId]: null
            }));
            
            // Set error if available
            if (data.message) {
              setErrors(prev => ({ ...prev, [accountId]: data.message }));
            }
          }
        } else {
          const errorData = await response.json();
          setErrors(prev => ({ 
            ...prev, 
            [accountId]: errorData.message || 'Failed to fetch channel info' 
          }));
        }
      } catch (error) {
        console.error(`Error fetching channel info for account ${accountId}:`, error);
        setErrors(prev => ({ 
          ...prev, 
          [accountId]: error.message || 'An unexpected error occurred' 
        }));
      } finally {
        setLoadingChannels(prev => ({ ...prev, [accountId]: false }));
        // Clean up pending fetch map
        pendingFetches.current.delete(accountId);
      }
    })();
    
    // Store the promise for deduplication
    pendingFetches.current.set(accountId, fetchPromise);
    return fetchPromise;
  }, []);

  // Fetch all channels when accounts change
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      accounts.forEach(account => {
        fetchChannelInfo(account.id);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  // Function to refresh a specific channel
  const refreshChannel = (accountId, force = false) => {
    if (accountId) {
      fetchChannelInfo(accountId, force);
    }
  };

  // Function to refresh all channels
  const refreshAllChannels = (force = false) => {
    if (accounts && accounts.length > 0) {
      accounts.forEach(account => {
        fetchChannelInfo(account.id, force);
      });
    }
  };

  return (
    <MultiChannelContext.Provider
      value={{
        channelsInfo,
        loadingChannels,
        errors,
        refreshChannel,
        refreshAllChannels
      }}
    >
      {children}
    </MultiChannelContext.Provider>
  );
}

// Custom hook to use the context
export function useMultiChannel() {
  const context = useContext(MultiChannelContext);
  if (context === undefined) {
    throw new Error('useMultiChannel must be used within a MultiChannelProvider');
  }
  return context;
} 