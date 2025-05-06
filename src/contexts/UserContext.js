'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// Create context
const UserContext = createContext(null);

// Provider component
export function UserProvider({ children }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user data from our API endpoint
  const fetchUserData = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.email) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/user');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch user data');
      }
      
      setUser(data.user);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError(error.message || 'Error fetching user data');
    } finally {
      setLoading(false);
    }
  }, [session, status]);

  // Update user data
  const updateUserData = async (updatedData) => {
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
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user data');
      }
      
      setUser(data.user);
      return data.user;
    } catch (error) {
      console.error('Error updating user data:', error);
      setError(error.message || 'Error updating user data');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Effect for initial data load and session changes
  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const value = {
    user,
    loading,
    error,
    refreshUser: fetchUserData,
    updateUser: updateUserData,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

// Custom hook for using the context
export function useUser() {
  const context = useContext(UserContext);
  if (context === null) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
} 