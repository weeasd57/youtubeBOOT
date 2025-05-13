'use client';

import { useState } from 'react';
import Image from 'next/image';
import { FaFileVideo } from 'react-icons/fa';

/**
 * A component for handling Google Drive thumbnails with proper error handling
 * 
 * @param {Object} props Component props
 * @param {string} props.src The thumbnail URL
 * @param {string} props.alt Alternative text for the image
 * @param {number} props.width Width of the thumbnail
 * @param {number} props.height Height of the thumbnail
 * @param {string} props.className Additional CSS classes
 * @param {string} props.fallbackText Text to show in fallback (first letter will be used if not provided)
 * @param {boolean} props.priority Whether to prioritize loading this image
 * @returns {JSX.Element} The thumbnail component
 */
export default function DriveThumbnail({ 
  src, 
  alt = 'Video thumbnail', 
  width = 56, 
  height = 56, 
  className = '', 
  fallbackText = '',
  priority = false
}) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  
  // Get first letter for fallback display
  const firstLetter = fallbackText ? fallbackText[0] : (alt ? alt[0] : 'V');
  
  // Handle loading error
  const handleError = () => {
    setError(true);
  };
  
  // Handle successful load
  const handleLoad = () => {
    setLoaded(true);
  };

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {!error && src ? (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className={`object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onError={handleError}
          onLoad={handleLoad}
          priority={priority}
          unoptimized={true} // Skip Next.js image optimization for Drive thumbnails
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-amber-500/20 dark:bg-amber-700/30">
          <div className="flex flex-col items-center justify-center">
            <FaFileVideo className="text-amber-600 dark:text-amber-400" size={width > 50 ? 24 : 16} />
            <span className="text-amber-700 dark:text-amber-300 font-medium text-xs mt-1">
              {firstLetter}
            </span>
          </div>
        </div>
      )}
      
      {/* Show loading state */}
      {!error && src && !loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="animate-pulse w-3/4 h-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      )}
    </div>
  );
} 