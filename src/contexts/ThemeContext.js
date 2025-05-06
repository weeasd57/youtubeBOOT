'use client';

import { createContext, useContext, useState, useEffect } from 'react';

// Create theme context
export const ThemeContext = createContext(null);

// Theme values
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
};

// Provider component
export function ThemeProvider({ children }) {
  // Initialize theme state from localStorage or system preference
  const [theme, setTheme] = useState(THEMES.LIGHT);
  const [mounted, setMounted] = useState(false);

  // Initialize theme on the client side only
  useEffect(() => {
    // Check localStorage first
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // If no saved theme, check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? THEMES.DARK : THEMES.LIGHT);
    }
    setMounted(true);
  }, []);

  // Update localStorage when theme changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('theme', theme);
      
      // Apply theme to document
      if (theme === THEMES.DARK) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme, mounted]);

  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme(prevTheme => 
      prevTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT
    );
  };

  // Set specific theme
  const setThemeMode = (mode) => {
    if (mode === THEMES.LIGHT || mode === THEMES.DARK) {
      setTheme(mode);
    }
  };

  // Don't render anything during SSR to prevent hydration mismatch
  // Use a very simple loader that doesn't affect layout
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider 
      value={{ 
        theme, 
        toggleTheme, 
        setTheme: setThemeMode,
        isDark: theme === THEMES.DARK 
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook to use the theme context
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 