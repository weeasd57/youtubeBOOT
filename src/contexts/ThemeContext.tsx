'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// Define the possible theme values
type Theme = 'light' | 'dark';

// Define the shape of the context data
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

// Create the context with an undefined default value
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Define the props for the ThemeProvider component
interface ThemeProviderProps {
  children: ReactNode;
}

// Create the ThemeProvider component
export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [theme, setTheme] = useState<Theme>('light'); // Default theme is light

  // Effect to load theme from localStorage and apply it to the document
  useEffect(() => {
    // Ensure this code runs only on the client-side
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('theme') as Theme | null;
      if (storedTheme) {
        setTheme(storedTheme);
        document.documentElement.setAttribute('data-theme', storedTheme);
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
    }
  }, [theme]); // Add theme to dependency array to re-apply if it changes programmatically elsewhere

  // Function to toggle the theme
  const toggleTheme = () => {
    setTheme((prevTheme) => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      // Ensure this code runs only on the client-side
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme); // Apply theme to HTML root for CSS
      }
      return newTheme;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use the ThemeContext
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 