'use client';

import { useContext } from 'react';
import { ThemeContext, THEMES } from '@/contexts/ThemeContext';
import { FaSun, FaMoon } from 'react-icons/fa';

export default function ThemeToggle() {
  try {
    const context = useContext(ThemeContext);
    
    // If context is undefined, return a disabled button
    if (!context) {
      return (
        <button 
          disabled
          className="p-2 rounded-md text-gray-400 cursor-not-allowed"
          aria-label="Theme toggle unavailable"
        >
          <FaMoon size={20} />
        </button>
      );
    }
    
    const { theme, toggleTheme } = context;
    const isDark = theme === THEMES.DARK;

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
    console.error('Error in ThemeToggle:', error);
    
    // Return a disabled button as fallback
    return (
      <button 
        disabled
        className="p-2 rounded-md text-gray-400 cursor-not-allowed"
        aria-label="Theme toggle error"
      >
        <FaMoon size={20} />
      </button>
    );
  }
} 