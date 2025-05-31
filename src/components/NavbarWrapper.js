'use client';

import { useSession } from 'next-auth/react';
import { useTheme } from '@/contexts/ThemeContext';
import Navbar from './Navbar';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

export default function NavbarWrapper() {
  const { data: session } = useSession();
  const { toggleTheme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const pathname = usePathname();
  
  // Check if we're on the landing page
  const isLandingPage = pathname === '/';
  
  // Hide navbar on terms and privacy pages
  const hideNavbar = pathname === '/terms' || pathname === '/privacy';
  
  // If navbar should be hidden, return null
  if (hideNavbar) {
    return null;
  }

  const handleRefreshAuth = async () => {
    setRefreshing(true);
    try {
      // Here you would implement any auth refresh logic
      // For example: await refreshSession();
      console.log('Auth refreshed');
    } catch (error) {
      console.error('Error refreshing auth:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Navbar
      user={session?.user || null}
      onRefreshAuth={handleRefreshAuth}
      refreshing={refreshing}
      themeToggle={toggleTheme}
      isLandingPage={isLandingPage}
    />
  );
} 