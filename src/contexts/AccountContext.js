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

  // Fetch connected accounts
  const fetchAccounts = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.email) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/accounts');
      const data = await response.json();
      
      if (response.ok) {
        // Make sure we have accounts data
        const accountsData = data.accounts || [];
        console.log('Fetched accounts:', accountsData.length);

        // Only update accounts state if the data has actually changed (simple check)
        if (accountsData.length !== accounts.length || 
            (accountsData.length > 0 && accounts.length > 0 && accountsData[0].id !== accounts[0].id)) {
            setAccounts(accountsData);
            console.log('Accounts state updated.');
        } else {
            console.log('Accounts data unchanged, skipping accounts state update.');
        }
        
        // Set active account if not already set or if current active account is not in the list
        const currentAccountStillExists = activeAccount && 
          accountsData.some(acc => acc.id === activeAccount.id);
          
        if ((!activeAccount || !currentAccountStillExists) && accountsData.length > 0) {
          // First try to find the primary account
          const primary = accountsData.find(acc => acc.is_primary);
          // Otherwise use the most recently used account (sorted by last_used_at)
          const sorted = [...accountsData].sort((a, b) => {
            return new Date(b.last_used_at || 0) - new Date(a.last_used_at || 0);
          });
          
          const newActive = primary || sorted[0];
          // Only update active account state if it's different
          if (!activeAccount || activeAccount.id !== newActive.id) {
              setActiveAccount(newActive);
              console.log('Set active account:', newActive?.account_name);
          } else {
              console.log('Active account unchanged.');
          }
        } else if (accountsData.length === 0 && activeAccount !== null) {
            // Clear active account if no accounts are fetched
            setActiveAccount(null);
            console.log('Cleared active account as no accounts were fetched.');
        }
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
  }, [session, status]);

  // Switch to a different account
  const switchAccount = async (accountId) => {
    try {
      const account = accounts.find(acc => acc.id === accountId);
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
      
      setActiveAccount(account);
      toast.success(`Switched to ${account.account_name || 'Google account'}`);
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

  // Load accounts when session changes
  useEffect(() => {
    // Fetch accounts only when the session is authenticated and authUserId is available
    if (status === 'authenticated' && session?.authUserId) {
      fetchAccounts();
    } else if (status === 'unauthenticated') {
      // Clear accounts and active account when unauthenticated
      setAccounts([]);
      setActiveAccount(null);
      setLoading(false);
    }
  }, [session, status, fetchAccounts]); // Depend on session and status

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

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

// Custom hook for using the context
export function useAccounts() {
  const context = useContext(AccountContext);
  if (context === null) {
    throw new Error('useAccounts must be used within an AccountProvider');
  }
  return context;
}
