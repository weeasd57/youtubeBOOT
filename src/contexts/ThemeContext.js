'use client';

import { createContext, useContext, useState, useEffect } from 'react';

// Create theme context with a default value
export const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
  isDark: false
});

// Theme values
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
};

// Provider component
export function ThemeProvider({ children }) {
  // Initialize with light theme by default
  const [theme, setTheme] = useState(THEMES.LIGHT);
  const [mounted, setMounted] = useState(false);

  // Initialize theme once on the client side
  useEffect(() => {
    // Simple detection for client-side
    if (typeof window === 'undefined') return;

    try {
      // Check localStorage first
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        setTheme(savedTheme);
      } else {
        // If no saved theme, check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? THEMES.DARK : THEMES.LIGHT);
      }
    } catch (error) {
      // Fallback to light theme on error
      console.error('Error initializing theme:', error);
    } finally {
      // Always set mounted to true
      setMounted(true);
    }
  }, []);

  // Update the document and localStorage when theme changes
  useEffect(() => {
    if (!mounted) return;
    
    try {
      // Update localStorage
      localStorage.setItem('theme', theme);
      
      // Update document class
      if (theme === THEMES.DARK) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (error) {
      console.error('Error applying theme:', error);
    }
  }, [theme, mounted]);

  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme(prevTheme => 
      prevTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT
    );
  };

  // Context value
  const contextValue = {
    theme,
    toggleTheme,
    setTheme: (mode) => {
      if (mode === THEMES.LIGHT || mode === THEMES.DARK) {
        setTheme(mode);
      }
    },
    isDark: theme === THEMES.DARK
  };

  // Return a simple provider with minimal calculation
  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook with error handling
export function useTheme() {
  const context = useContext(ThemeContext);
  
  if (!context) {
    console.error('useTheme: Theme context is undefined! Make sure you are using ThemeProvider.');
    return {
      theme: THEMES.LIGHT,
      toggleTheme: () => {},
      setTheme: () => {},
      isDark: false
    };
  }
  
  return context;
} 