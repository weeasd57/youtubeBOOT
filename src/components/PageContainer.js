'use client';

import { useState } from 'react';
import { FaYoutube, FaSync } from 'react-icons/fa';
import { signOut } from 'next-auth/react';
import Image from "next/image";
import ThemeToggle from './ThemeToggle';
import Navbar from './Navbar';
import ClientOnly from './ClientOnly';

export default function PageContainer({ user, children, onRefresh = null }) {
  const [refreshing, setRefreshing] = useState(false);

  // Function to refresh authentication
  const handleRefreshAuth = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('Authentication refreshed successfully!');
          // If there's an onRefresh callback, call it
          if (onRefresh) onRefresh();
        } else {
          alert(data.message || 'Failed to refresh authentication.');
        }
      } else {
        alert('Failed to refresh authentication. Please try signing out and in again.');
      }
    } catch (error) {
      console.error('Error refreshing auth:', error);
      alert('Error refreshing authentication. Please try again later.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen p-8 flex flex-col dark:bg-black transition-colors duration-300">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <FaYoutube className="text-red-600 text-3xl" />
          <h1 className="text-2xl font-bold dark:text-amber-50">YouTube Drive Uploader</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <ClientOnly>
            <ThemeToggle />
          </ClientOnly>
          
          <ClientOnly>
            {user && (
              <div className="flex items-center gap-2">
                {user.image && (
                  <Image 
                    src={user.image}
                    alt={user.name || 'User'}
                    width={32}
                    height={32}
                    className="rounded-full border dark:border-amber-500/30"
                  />
                )}
                <span className="text-sm font-medium dark:text-amber-50">{user.name}</span>
              </div>
            )}
          </ClientOnly>
          
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-full text-blue-500 dark:text-amber-400 hover:bg-blue-50 dark:hover:bg-amber-900/20 transition-all duration-300 transform hover:rotate-12"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          
          {user && (
            <button
              onClick={handleRefreshAuth}
              disabled={refreshing}
              title="Refresh Authentication"
              className="p-2 rounded-full text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-300 disabled:opacity-50"
            >
              <FaSync className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
          
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md border border-transparent dark:border-amber-500/20 transition-all duration-300 transform hover:scale-105"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Navbar - sticky */}
      <Navbar />

      {/* Content with padding to account for sticky navbar */}
      <div className="mt-4 pb-16">
        {children}
      </div>
    </div>
  );
} 