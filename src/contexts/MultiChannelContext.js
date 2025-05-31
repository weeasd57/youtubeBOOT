import { createContext, useContext, useState, useEffect } from 'react';
import { useAccounts } from './AccountContext';

// Create context
const MultiChannelContext = createContext();

export function MultiChannelProvider({ children }) {
  const [channelsInfo, setChannelsInfo] = useState({});
  const [loadingChannels, setLoadingChannels] = useState({});
  const [errors, setErrors] = useState({});
  const { accounts } = useAccounts();

  // Fetch channel info for a specific account
  const fetchChannelInfo = async (accountId) => {
    if (!accountId || loadingChannels[accountId]) return;
    
    setLoadingChannels(prev => ({ ...prev, [accountId]: true }));
    setErrors(prev => ({ ...prev, [accountId]: null }));
    
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
    }
  };

  // Fetch all channels when accounts change
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      accounts.forEach(account => {
        // Only fetch if we don't already have info for this account
        if (!channelsInfo[account.id] && !loadingChannels[account.id]) {
          fetchChannelInfo(account.id);
        }
      });
    }
  }, [accounts, channelsInfo, loadingChannels]);

  // Function to refresh a specific channel
  const refreshChannel = (accountId) => {
    if (accountId) {
      fetchChannelInfo(accountId);
    }
  };

  // Function to refresh all channels
  const refreshAllChannels = () => {
    if (accounts && accounts.length > 0) {
      accounts.forEach(account => {
        fetchChannelInfo(account.id);
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