'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const { data: session, status } = useSession();
  const [accounts, setAccounts] = useState([]);
  const [activeAccount, setActiveAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch connected accounts - optimized to prevent infinite loops
  const fetchAccounts = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.email) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching accounts...');
      const response = await fetch('/api/accounts');
      const data = await response.json();
      
      if (response.ok) {
        const accountsData = data.accounts || [];
        console.log('Fetched accounts:', accountsData.length);

        // Update accounts state only if data has changed
        setAccounts(prevAccounts => {
          // Simple deep comparison
          const hasChanged = JSON.stringify(prevAccounts) !== JSON.stringify(accountsData);
          return hasChanged ? accountsData : prevAccounts;
        });

        // Handle active account
        setActiveAccount(prevActive => {
          if (accountsData.length === 0) {
            return null;
          }

          // Check if current active account still exists
          const currentAccountExists = prevActive && 
            accountsData.some(acc => acc.id === prevActive.id);
          
          if (currentAccountExists) {
            return prevActive;
          }

          // Find primary or most recently used account
          const primary = accountsData.find(acc => acc.is_primary);
          const sorted = [...accountsData].sort((a, b) => {
            return new Date(b.last_used_at || 0) - new Date(a.last_used_at || 0);
          });
          
          return primary || sorted[0] || null;
        });
      } else {
        console.error('Failed to fetch accounts:', data.error);
        setError(data.error || 'Failed to fetch accounts');
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setError(error.message || 'Error fetching accounts');
    } finally {
      setLoading(false);
    }
  }, [session, status]); // Removed accounts and activeAccount from dependencies

  // Switch to a different account
  const switchAccount = async (accountId) => {
    try {
      // First, find the account in current accounts list
      let account = accounts.find(acc => acc.id === accountId);
      
      if (!account) {
        // If not found, refresh accounts first
        await fetchAccounts();
        // Wait a bit for state to update, then check again
        await new Promise(resolve => setTimeout(resolve, 100));
        account = accounts.find(acc => acc.id === accountId);
      }
      
      if (!account) {
        throw new Error('Account not found');
      }
      
      // Update last_used_at on the server
      const response = await fetch(`/api/accounts/${accountId}/activate`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to switch account');
      }
      
      // Set the active account immediately
      setActiveAccount(account);
      toast.success(`Switched to ${account.name || 'Google account'}`);
      
      // Refresh accounts in background to update last_used_at
      fetchAccounts();
      
      return true;
    } catch (error) {
      console.error('Error switching account:', error);
      toast.error(error.message || 'Failed to switch account');
      return false;
    }
  };

  // Set an account as primary
  const setPrimaryAccount = async (accountId) => {
    try {
      const response = await fetch(`/api/accounts/${accountId}/primary`, {
        method: 'PATCH'
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to set primary account');
      }
      
      // Update local state
      setAccounts(accounts.map(account => ({
        ...account,
        is_primary: account.id === accountId
      })));
      
      toast.success('Primary account updated');
      return true;
    } catch (error) {
      console.error('Error setting primary account:', error);
      toast.error(error.message || 'Failed to set primary account');
      return false;
    }
  };

  // Remove an account
  const removeAccount = async (accountId) => {
    try {
      // Check if this is the only account
      if (accounts.length === 1) {
        throw new Error('Cannot remove the only account. Add another account first.');
      }
      
      // Check if this is the primary account
      const account = accounts.find(acc => acc.id === accountId);
      if (account?.is_primary) {
        throw new Error('Cannot remove primary account. Set another account as primary first.');
      }
      
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove account');
      }
      
      // Update local state
      setAccounts(accounts.filter(account => account.id !== accountId));
      
      // If the active account was removed, switch to another one
      if (activeAccount?.id === accountId) {
        const newActive = accounts.find(acc => acc.id !== accountId);
        if (newActive) {
          setActiveAccount(newActive);
        }
      }
      
      toast.success('Account removed');
      return true;
    } catch (error) {
      console.error('Error removing account:', error);
      toast.error(error.message || 'Failed to remove account');
      return false;
    }
  };

  // Load accounts when session changes - with debounce to prevent rapid calls
  useEffect(() => {
    console.log('AccountContext useEffect triggered');
    
    // Only fetch if authenticated
    if (status === 'authenticated' && session?.user?.email) {
      const timer = setTimeout(() => {
        fetchAccounts();
      }, 500); // Small delay to prevent rapid successive calls
      
      return () => clearTimeout(timer);
    } else if (status === 'unauthenticated') {
      // Clear state when unauthenticated
      setAccounts([]);
      setActiveAccount(null);
      setLoading(false);
    }
  }, [session?.user?.email, status, session?.authUserId]); // Also depend on authUserId to refresh when it changes

  // Additional effect to refresh accounts when returning from adding a new account
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('addingFor') && status === 'authenticated') {
        // Remove the parameter from URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        
        // Refresh accounts after a short delay to ensure the new account is saved
        setTimeout(() => {
          fetchAccounts();
        }, 1000);
      }
    }
  }, [status, fetchAccounts]);

  const value = {
    accounts,
    activeAccount,
    loading,
    error,
    switchAccount,
    setPrimaryAccount,
    removeAccount,
    refreshAccounts: fetchAccounts
  };

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  );
}

// Custom hook for using the context
export function useAccounts() {
  const context = useContext(AccountContext);
  if (context === null) {
    throw new Error('useAccounts must be used within an AccountProvider');
  }
  return context;
}
