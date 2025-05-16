'use client';

import Navbar from '@/components/Navbar';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/contexts/ThemeContext';
import { FaSun, FaMoon } from 'react-icons/fa';
import { useState } from 'react';

export default function DashboardLayout({ children }) {
  const { data: session, status } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  
  const handleRefreshAuth = async () => {
    setRefreshing(true);
    try {
      // يمكن إضافة منطق لتحديث معلومات المصادقة هنا إذا لزم الأمر
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setRefreshing(false);
    }
  };
  
  const ThemeToggle = (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <FaSun className="w-5 h-5" />
      ) : (
        <FaMoon className="w-5 h-5" />
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* عرض شريط التنقل فقط إذا كان المستخدم مسجل الدخول */}
      {status === 'authenticated' && (
        <Navbar 
          user={session.user} 
          onRefreshAuth={handleRefreshAuth} 
          refreshing={refreshing} 
          themeToggle={ThemeToggle}
        />
      )}
      
      <div className="container mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  );
} 