'use client';

import React from 'react';
import { useTheme, THEMES } from '@/contexts/ThemeContext';
import { FaSun, FaMoon } from 'react-icons/fa';

const ThemeToggleDebug: React.FC = () => {
  try {
    const { theme, toggleTheme } = useTheme();
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
    const errorMessage = error instanceof Error ? error.message : 'Theme Error';
    console.error('Error in ThemeToggleDebug:', error);
    
    return (
      <div className="px-2 py-1 bg-red-100 border border-red-300 text-red-800 rounded text-xs">
        {errorMessage}
      </div>
    );
  }
};

export default ThemeToggleDebug;
