'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// Define theme values as constants
export const THEMES = {
  LIGHT: 'light' as const,
  DARK: 'dark' as const
};

// Define the possible theme values
type Theme = typeof THEMES[keyof typeof THEMES];

// Define the shape of the context data
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

// Create the context with better default values
const ThemeContext = createContext<ThemeContextType>({
  theme: THEMES.DARK,
  toggleTheme: () => {},
  setTheme: () => {},
  isDark: true
});

// Define the props for the ThemeProvider component
interface ThemeProviderProps {
  children: ReactNode;
}

// Create the ThemeProvider component
export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [theme, setThemeState] = useState<Theme>(THEMES.DARK);
  const [mounted, setMounted] = useState(false);

  // Initialize theme once on the client side
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedTheme = localStorage.getItem('theme') as Theme | null;
      if (storedTheme && (storedTheme === THEMES.LIGHT || storedTheme === THEMES.DARK)) {
        setThemeState(storedTheme);
      }
    } catch (error) {
      console.error('Error initializing theme:', error);
    } finally {
      setMounted(true);
    }
  }, []);

  // Effect to apply theme changes to document
  useEffect(() => {
    if (!mounted) return;

    try {
      // Update localStorage
      localStorage.setItem('theme', theme);

      // Update document attributes for Tailwind and custom CSS
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === THEMES.DARK) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (error) {
      console.error('Error applying theme:', error);
    }
  }, [theme, mounted]);

  // Function to toggle the theme
  const toggleTheme = () => {
    setThemeState(prevTheme => 
      prevTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT
    );
  };

  // Function to set theme directly
  const setTheme = (newTheme: Theme) => {
    if (newTheme === THEMES.LIGHT || newTheme === THEMES.DARK) {
      setThemeState(newTheme);
    }
  };

  const value: ThemeContextType = {
    theme,
    toggleTheme,
    setTheme,
    isDark: theme === THEMES.DARK
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Enhanced custom hook with better error handling
export const useTheme = () => {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};