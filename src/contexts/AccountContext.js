'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

// Create context
const AccountContext = createContext(null);

// Provider component
export function AccountProvider({ children }) {
  const { data: session, status } = useSession();
  console.log('[DEBUG][AccountProvider] render, status:', status, 'session:', session);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  // Effect for initial data load when session changes
  useEffect(() => {
    let isMounted = true;
    console.log('[DEBUG][AccountContext] useEffect fired', { status, session });
    if (status === 'authenticated' && session?.user?.auth_user_id) {
      (async () => {
        console.log('[DEBUG][AccountContext] useEffect inlined fetchAccounts logic, status:', status, 'session:', session);
        if (!isMounted) return;
        setLoading(true);
        setError(null);
        try {
          const response = await fetch('/api/accounts');
          const data = await response.json();
          if (response.ok) {
            if (isMounted) {
              setAccounts(data.accounts || []);
              console.log('[DEBUG][AccountContext] setAccounts immediate:', data.accounts);
            }
            setTimeout(() => {
              if (isMounted) console.log('[DEBUG][AccountContext] accounts state after set:', accounts);
            }, 1000);

            // No active account logic needed
          } else {
            if (isMounted) setError(`Failed to fetch accounts: ${data.error}`);
          }
        } catch (error) {
          console.error('Error fetching accounts:', error);
          if (isMounted) setError(`Error fetching accounts: ${error.message}`);
        } finally {
          if (isMounted) setLoading(false);
        }
      })();
    }
    return () => { isMounted = false; };
  }, [status, session]);

  // Switch account
  // switchAccount removed (no active account logic)

  // Set primary account
  // setPrimaryAccount removed (no active account logic)

  // Remove account
  // removeAccount removed (no active account logic)

  const value = {
    accounts,
    loading,
    error,
  };

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

// Custom hook for using the context
export function useAccounts() {
  const context = useContext(AccountContext);
  console.log('[DEBUG][useAccounts] context value:', context);
  if (context === null) {
    throw new Error('useAccounts must be used within an AccountProvider');
  }
  return context;
}