import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export function useSupabaseUser() {
  const { data: session, status } = useSession();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user data from our API endpoint
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      fetchUserData();
    } else if (status === 'unauthenticated') {
      setUserData(null);
      setLoading(false);
    }
  }, [session, status]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/user');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch user data');
      }
      
      setUserData(data.user);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

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
      
      setUserData(data.user);
      return data.user;
    } catch (error) {
      console.error('Error updating user data:', error);
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    user: userData,
    loading,
    error,
    refreshUser: fetchUserData,
    updateUser: updateUserData,
  };
} 