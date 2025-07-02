'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Account } from '@/types/account';

// Create context
interface AccountContextType {
  accounts: Account[];
  loading: boolean;
  error: string | null;
  refreshAccounts: () => void;
}

const AccountContext = createContext<AccountContextType | null>(null);

// Provider component
export function AccountProvider({ children }: { children: React.ReactNode }) {
  console.log('[AccountProvider] AccountProvider rendering...');
  const { data: session, status } = useSession();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialMount = useRef(true);
  
  // Function to fetch accounts
  const fetchAccounts = useCallback(async (userId: string) => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('[AccountContext] Attempting to fetch accounts from /api/accounts...');
      const response = await fetch('/api/accounts');
      console.log('[AccountContext] Raw API Response:', response);
      console.log('[AccountContext] API Response Status:', response.status);
      console.log('[AccountContext] API Response Status Text:', response.statusText);
      console.log('[AccountContext] API Response OK:', response.ok);
      console.log('[AccountContext] API Response Type:', response.type);
      
      // Handle unauthorized explicitly
      if (response.status === 401) {
        console.warn('[AccountContext] Received 401 – user not authenticated');
        setAccounts([]);
        setLoading(false);
        // Let the global auth flow handle redirect; just exit.
        return;
      }
      
      let data;
      try {
        data = await response.json();
        console.log('[AccountContext] API Response Data (parsed):', data);
      } catch (jsonError) {
        console.error('[AccountContext] Error parsing JSON response:', jsonError, 'Response status:', response.status);
        if (!response.ok) {
          const errorBody = await response.text();
          console.error('[AccountContext] Non-OK response body:', errorBody);
        }
        setError(`Error parsing API response: ${jsonError.message}`);
        setLoading(false);
        return;
      }
      
      if (response.ok) {
            setAccounts(data.accounts || []);
            console.log('[AccountContext] Accounts set in state:', data.accounts || []);
      } else {
        setError(`Failed to fetch accounts: ${data.error || 'Unknown error'}`);
        console.error('[AccountContext] Failed to fetch accounts error:', data.error || 'Unknown error');
      }
    } catch (error: any) {
          console.error('Error fetching accounts (network or unexpected):', error);
          setError(`Error fetching accounts: ${error.message}`);
    } finally {
            setLoading(false);
    }
  }, []);

  // Expose a refresh function
  const refreshAccounts = useCallback(() => {
    if (session?.user?.auth_user_id) {
      fetchAccounts(session.user.auth_user_id);
    }
  }, [session?.user?.auth_user_id, fetchAccounts]);

  // Effect for initial data load when session changes
  useEffect(() => {
    console.log('[AccountContext] useEffect triggered. Status:', status, 'User ID:', session?.user?.auth_user_id);
    if (status === 'authenticated' && session?.user?.auth_user_id) {
      console.log('[AccountContext] Fetch condition met. Calling fetchAccounts...');
      fetchAccounts(session.user.auth_user_id);
    } else if (status === 'unauthenticated') {
      // Reset state when unauthenticated
      setAccounts([]);
      setLoading(false);
      setError(null);
    }
  }, [status, session?.user?.auth_user_id, fetchAccounts]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo<AccountContextType>(() => {
    console.log('[AccountContext] Memoized value being created/updated. Accounts:', accounts);
    return {
      accounts,
      loading,
      error,
      refreshAccounts,
    };
  }, [accounts, loading, error, refreshAccounts]);

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