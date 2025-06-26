'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

// Unified interfaces for user and account data
interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  // Add any other user properties here
}

interface Account {
  id: string;
  email: string;
  name?: string;
  is_primary: boolean;
  last_used_at?: string;
}

interface UserContextType {
  // User-related state
  user: User | null;
  accounts: Account[];
  activeAccount: Account | null;
  loading: boolean;
  error: string | null;

  // User actions
  refreshUser: () => Promise<void>;
  updateUser: (updatedData: Partial<User>) => Promise<User | null>;
  
  // Account actions
  refreshAccounts: () => Promise<void>;
  setActiveAccount: (account: Account | null) => void;
  switchAccount: (accountId: string) => Promise<boolean>;
  setPrimaryAccount: (accountId: string) => Promise<boolean>;
  removeAccount: (accountId: string) => Promise<boolean>;
}

interface UserProviderProps {
  children: ReactNode;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: UserProviderProps) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user data from our API endpoint
  const fetchUserData = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.email) {
      setUser(null);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/user');
      if (!response.ok) {
        const data: { error: string } = await response.json();
        setUser(null);
        setError(data.error || 'Failed to fetch user data');
        return;
      }
      
      const data: { user: User } = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUser(null);
      setError('Error fetching user data');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.email, status]);

  // Fetch connected accounts
  const fetchAccounts = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.email) {
      setAccounts([]);
      setActiveAccount(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/accounts');
      const data: { accounts: Account[]; error?: string } = await response.json();
      
      if (response.ok) {
        const accountsData = data.accounts || [];

        // Update accounts state only if data has changed significantly
        setAccounts(prevAccounts => {
          if (prevAccounts.length !== accountsData.length) {
            return accountsData;
          }

          // Deep comparison on essential properties
          const hasSignificantChange = accountsData.some(newAcc => {
            const oldAcc = prevAccounts.find(p => p.id === newAcc.id);
            return !oldAcc || 
              oldAcc.email !== newAcc.email || 
              oldAcc.name !== newAcc.name || 
              oldAcc.is_primary !== newAcc.is_primary;
          });

          return hasSignificantChange ? accountsData : prevAccounts;
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
            return new Date(b.last_used_at || 0).getTime() - new Date(a.last_used_at || 0).getTime();
          });
          
          return primary || sorted[0] || null;
        });
      } else {
        console.error('Failed to fetch accounts:', data.error);
        setError(data.error || 'Failed to fetch accounts');
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      const message = error instanceof Error ? error.message : 'Error fetching accounts';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.email, status]);

  // Update user data
  const updateUserData = async (updatedData: Partial<User>): Promise<User | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });
      
      const data: { user: User; error?: string } = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user data');
      }
      
      setUser(data.user);
      toast.success('User data updated successfully');
      return data.user;
    } catch (error) {
      console.error('Error updating user data:', error);
      const message = error instanceof Error ? error.message : 'Error updating user data';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Switch to a different account
  const switchAccount = useCallback(async (accountId: string): Promise<boolean> => {
    const targetAccount = accounts.find(acc => acc.id === accountId);
    if (!targetAccount) {
      toast.error('Account not found');
      return false;
    }

    try {
      setActiveAccount(targetAccount);
      localStorage.setItem('activeAccountId', targetAccount.id);
      
      // Clear any cached data
      localStorage.removeItem('driveFolders');
      localStorage.removeItem('lastDriveRefresh');
      
      toast.success(`Switched to account: ${targetAccount.email}`);
      return true;
    } catch (error) {
      console.error('Error switching account:', error);
      toast.error('Failed to switch account');
      return false;
    }
  }, [accounts]);

  // Set an account as primary
  const setPrimaryAccount = async (accountId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/accounts/${accountId}/primary`, {
        method: 'PATCH'
      });
      
      if (!response.ok) {
        const data: { error: string } = await response.json();
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
      const message = error instanceof Error ? error.message : 'Failed to set primary account';
      toast.error(message);
      return false;
    }
  };

  // Remove an account
  const removeAccount = async (accountId: string): Promise<boolean> => {
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
        const data: { error: string } = await response.json();
        throw new Error(data.error || 'Failed to remove account');
      }
      
      // Update local state
      setAccounts(accounts.filter(account => account.id !== accountId));
      
      // If the active account was removed, switch to another one
      if (activeAccount?.id === accountId) {
        const newActive = accounts.find(acc => acc.id !== accountId);
        if (newActive) {
          setActiveAccount(newActive);
          localStorage.setItem('activeAccountId', newActive.id);
        }
      }
      
      toast.success('Account removed');
      return true;
    } catch (error) {
      console.error('Error removing account:', error);
      const message = error instanceof Error ? error.message : 'Failed to remove account';
      toast.error(message);
      return false;
    }
  };

  // Initialize active account from localStorage
  useEffect(() => {
    const initializeActiveAccount = () => {
      if (loading || !accounts.length) return;

      const savedAccountId = localStorage.getItem('activeAccountId');
      if (savedAccountId) {
        const savedAccount = accounts.find(acc => acc.id === savedAccountId);
        if (savedAccount) {
          setActiveAccount(savedAccount);
          return;
        }
      }

      // Fallback to primary account or first account
      const primaryAccount = accounts.find(acc => acc.is_primary);
      setActiveAccount(primaryAccount || accounts[0]);
      if (primaryAccount) {
        localStorage.setItem('activeAccountId', primaryAccount.id);
      }
    };

    initializeActiveAccount();
  }, [accounts, loading]);

  // Load initial data when session changes
  useEffect(() => {
    if (status === 'loading') {
      setLoading(true);
      return;
    }

    if (status === 'authenticated' && session?.user?.email) {
      Promise.all([
        fetchUserData(),
        fetchAccounts()
      ]).catch(error => {
        console.error('Error loading initial data:', error);
        toast.error('Failed to load user data');
      });
    } else if (status === 'unauthenticated') {
      setUser(null);
      setAccounts([]);
      setActiveAccount(null);
      setLoading(false);
    }
  }, [session?.user?.email, status, fetchUserData, fetchAccounts]);

  // Refresh accounts when returning from adding a new account
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('addingFor') && status === 'authenticated') {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        
        setTimeout(() => {
          fetchAccounts();
        }, 1000);
      }
    }
  }, [status, fetchAccounts]);

  const value: UserContextType = {
    // User state
    user,
    accounts,
    activeAccount,
    loading,
    error,

    // User actions
    refreshUser: fetchUserData,
    updateUser: updateUserData,

    // Account actions
    refreshAccounts: fetchAccounts,
    setActiveAccount: useCallback((account: Account | null) => {
      setActiveAccount(account);
      if (account) {
        localStorage.setItem('activeAccountId', account.id);
      }
    }, []),
    switchAccount,
    setPrimaryAccount,
    removeAccount
  };

  return (
    <UserContext.Provider value={useMemo(() => ({
      user,
      accounts,
      activeAccount,
      loading,
      error,
      refreshUser: fetchUserData,
      updateUser: updateUserData,
      refreshAccounts: fetchAccounts,
      setActiveAccount,
      switchAccount,
      setPrimaryAccount,
      removeAccount,
    }), [user, accounts, activeAccount, loading, error, fetchUserData, updateUserData, fetchAccounts, setActiveAccount, switchAccount, setPrimaryAccount, removeAccount])}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (context === null) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
