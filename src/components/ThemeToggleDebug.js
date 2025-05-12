'use client';

import { useContext } from 'react';
import { ThemeContext, THEMES } from '@/contexts/ThemeContext';
import { FaSun, FaMoon } from 'react-icons/fa';

export default function ThemeToggleDebug() {
  // Use a try-catch block to properly handle theme context errors
  try {
    const context = useContext(ThemeContext);
    
    if (!context) {
      console.error('Theme context is undefined or null!', { context });
      return (
        <div className="px-2 py-1 bg-red-100 border border-red-300 text-red-800 rounded text-xs">
          Theme Error
        </div>
      );
    }
    
    const { theme, toggleTheme } = context;
    const isDark = theme === THEMES.DARK;
    
    console.log('Theme context loaded successfully:', { theme, isDark });

    return (
      <button
        onClick={toggleTheme}
        className="p-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50 focus:ring-blue-500"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? (
          <FaSun className="text-yellow-300 hover:text-yellow-400 transition-colors" size={20} />
        ) : (
          <FaMoon className="text-gray-600 hover:text-gray-800 transition-colors dark:text-gray-400 dark:hover:text-gray-300" size={20} />
        )}
      </button>
    );
  } catch (error) {
    console.error('Error in ThemeToggleDebug:', error);
    return (
      <div className="px-2 py-1 bg-red-100 border border-red-300 text-red-800 rounded text-xs">
        {error.message || 'Theme Error'}
      </div>
    );
  }
} 