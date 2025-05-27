'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook for responsive design that detects if the current viewport matches a media query
 * @param {string} query - The media query to check against (e.g. '(max-width: 768px)')
 * @returns {boolean} - Whether the media query matches
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);
  
  useEffect(() => {
    // Check if window is available (client-side only)
    if (typeof window === 'undefined') return;
    
    // Create media query list
    const media = window.matchMedia(query);
    
    // Set initial value
    setMatches(media.matches);
    
    // Define listener function
    const listener = (event) => {
      setMatches(event.matches);
    };
    
    // Add listener
    media.addEventListener('change', listener);
    
    // Clean up
    return () => {
      media.removeEventListener('change', listener);
    };
  }, [query]);
  
  return matches;
}
