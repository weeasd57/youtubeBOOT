'use client';

import { useState, useEffect } from 'react';
import { FaSpinner } from 'react-icons/fa';

export default function UploadProgress({ fileId }) {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [intervalId, setIntervalId] = useState(null);

  useEffect(() => {
    if (!fileId) return;
    
    // Function to fetch progress
    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/upload?fileId=${fileId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch progress');
        }
        
        const data = await response.json();
        setProgress(data.progress || 0);
        
        // If progress reaches 100%, clear the interval
        if (data.progress === 100) {
          clearInterval(intervalId);
        }
      } catch (err) {
        setError(err.message);
      }
    };
    
    // Initial fetch
    fetchProgress();
    
    // Set up interval to fetch progress every 2 seconds
    const id = setInterval(fetchProgress, 2000);
    setIntervalId(id);
    
    // Clean up interval on unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fileId]);
  
  // Clean up when reaching 100%
  useEffect(() => {
    if (progress === 100 && intervalId) {
      clearInterval(intervalId);
    }
  }, [progress, intervalId]);
  
  if (error) {
    return <div className="text-red-500">{error}</div>;
  }
  
  return (
    <div className="w-full mt-4">
      <div className="flex items-center mb-1">
        <FaSpinner className="animate-spin mr-2" />
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Uploading to YouTube... {progress}%
        </p>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
        <div 
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Please don't close this page until upload completes
      </p>
    </div>
  );
} 