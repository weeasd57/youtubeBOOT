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
      console.log('[UserContext] fetchAccounts: Not authenticated or no user email.');
      setAccounts([]);
      setActiveAccount(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('[UserContext] fetchAccounts: Fetching accounts from /api/accounts...');
      const response = await fetch('/api/accounts');
      const data: { accounts: Account[]; error?: string } = await response.json();
      
      if (response.ok) {
        const accountsData = data.accounts || [];
        console.log('[UserContext] fetchAccounts: Accounts data from API:', accountsData);

        // Update accounts state only if data has changed significantly
        setAccounts(prevAccounts => {
          if (prevAccounts.length !== accountsData.length) {
            console.log('[UserContext] setAccounts: Length changed, updating.');
            return accountsData;
          }

          // Deep comparison on essential properties
          const hasSignificantChange = accountsData.some(newAcc => {
            const oldAcc = prevAccounts.find(p => p.id === newAcc.id);
            return !oldAcc || 
              oldAcc.email !== newAcc.email || 
              oldAcc.name !== newAcc.name || 
              oldAcc.is_primary !== newAcc.is_primary; // Include is_primary in comparison
          });
          console.log('[UserContext] setAccounts: Significant change detected:', hasSignificantChange);
          return hasSignificantChange ? accountsData : prevAccounts;
        });

        // Handle active account
        setActiveAccount(prevActive => {
          console.log('[UserContext] setActiveAccount (callback): Current prevActive:', prevActive);
          console.log('[UserContext] setActiveAccount (callback): accountsData:', accountsData);

          if (accountsData.length === 0) {
            console.log('[UserContext] setActiveAccount: No accounts data, setting to null.');
            return null;
          }

          // Check if current active account still exists
          const currentAccountExists = prevActive && 
            accountsData.some(acc => acc.id === prevActive.id);
          
          if (currentAccountExists) {
            console.log('[UserContext] setActiveAccount: Previous active account still exists.', prevActive);
            return prevActive;
          }

          // Find primary or most recently used account
          const primary = accountsData.find(acc => acc.is_primary);
          const sorted = [...accountsData].sort((a, b) => {
            return new Date(b.last_used_at || 0).getTime() - new Date(a.last_used_at || 0).getTime();
          });
          
          const chosenAccount = primary || sorted[0] || null;
          console.log('[UserContext] setActiveAccount: Chosen account:', chosenAccount);
          return chosenAccount;
        });
      } else {
        console.error('[UserContext] Failed to fetch accounts API error:', data.error);
        setError(data.error || 'Failed to fetch accounts');
      }
    } catch (error) {
      console.error('[UserContext] Error fetching accounts (catch block):', error);
      const message = error instanceof Error ? error.message : 'Error fetching accounts';
      setError(message);
    } finally {
      setLoading(false);
      console.log('[UserContext] fetchAccounts: Loading set to false.');
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
      console.log('[UserContext] initializeActiveAccount: Running.');
      console.log('[UserContext] initializeActiveAccount: Accounts length:', accounts.length);

      if (loading || !accounts.length) {
        console.log('[UserContext] initializeActiveAccount: Still loading or no accounts, returning.');
        return;
      }

      const savedAccountId = localStorage.getItem('activeAccountId');
      console.log('[UserContext] initializeActiveAccount: Saved account ID from localStorage:', savedAccountId);

      if (savedAccountId) {
        const savedAccount = accounts.find(acc => acc.id === savedAccountId);
        if (savedAccount) {
          setActiveAccount(savedAccount);
          console.log('[UserContext] initializeActiveAccount: Set active account from localStorage:', savedAccount);
          return;
        }
      }

      // Fallback to primary account or first account
      const primaryAccount = accounts.find(acc => acc.is_primary);
      const fallbackAccount = primaryAccount || accounts[0];
      setActiveAccount(fallbackAccount);
      console.log('[UserContext] initializeActiveAccount: Set fallback active account:', fallbackAccount);

      if (fallbackAccount) {
        localStorage.setItem('activeAccountId', fallbackAccount.id);
        console.log('[UserContext] initializeActiveAccount: Saved fallback account to localStorage:', fallbackAccount.id);
      }
    };

    initializeActiveAccount();
  }, [accounts, loading]); // Add accounts and loading to dependencies

  // Load initial data when session changes
  useEffect(() => {
    console.log('[UserContext] Initial data load useEffect triggered. Status:', status);
    if (status === 'loading') {
      setLoading(true);
      return;
    }

    if (status === 'authenticated' && session?.user?.email) {
      console.log('[UserContext] Initial data load: Authenticated. Fetching user and accounts.');
      Promise.all([
        fetchUserData(),
        fetchAccounts()
      ]).catch(error => {
        console.error('[UserContext] Error loading initial data:', error);
        toast.error('Failed to load user data');
      });
    } else if (status === 'unauthenticated') {
      console.log('[UserContext] Initial data load: Unauthenticated. Resetting state.');
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
        console.log('[UserContext] addingFor param detected, refreshing accounts.');
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
      console.log('[UserContext] Manual setActiveAccount call:', account);
      setActiveAccount(account);
      if (account) {
        localStorage.setItem('activeAccountId', account.id);
        console.log('[UserContext] Manual setActiveAccount: Saved to localStorage:', account.id);
      } else {
        localStorage.removeItem('activeAccountId');
        console.log('[UserContext] Manual setActiveAccount: Removed from localStorage.');
      }
    }, []),
    switchAccount,
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
      removeAccount,
    }), [user, accounts, activeAccount, loading, error, fetchUserData, updateUserData, fetchAccounts, setActiveAccount, switchAccount, removeAccount])}>
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
