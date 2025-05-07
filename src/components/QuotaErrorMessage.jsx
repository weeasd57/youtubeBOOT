import React from 'react';
import { FaExclamationTriangle, FaInfoCircle, FaHistory } from 'react-icons/fa';
import { useYouTube } from '@/contexts/YouTubeContext';

/**
 * Component to display when YouTube API quota is exceeded
 */
export default function QuotaErrorMessage({ message }) {
  const { dailyQuotaExceeded, resetQuotaExceeded } = useYouTube();
  
  // Get when the quota will reset (midnight Pacific Time)
  const getQuotaResetTime = () => {
    const now = new Date();
    const pacificTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
    
    // Create tomorrow at midnight Pacific time
    const tomorrow = new Date(pacificTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    // Convert back to local time for display
    const tomorrowLocalTime = new Date(tomorrow.toLocaleString("en-US", {timeZone: "UTC"}));
    
    // Format the time
    return tomorrowLocalTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };
  
  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4 my-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <FaExclamationTriangle className="h-5 w-5 text-amber-400" aria-hidden="true" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
            YouTube API Quota Exceeded
          </h3>
          <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            <p>
              {dailyQuotaExceeded 
                ? 'The daily YouTube API quota has been exceeded. The application will automatically retry tomorrow.'
                : message || 'The daily YouTube API quota has been exceeded. This is a limitation imposed by YouTube and not an error with the application.'}
            </p>
            <p className="mt-2">
              Your videos will still upload correctly, but the display of your channel videos is temporarily limited until the quota resets.
            </p>
            
            <div className="mt-4 bg-amber-100 dark:bg-amber-900/50 p-3 rounded border border-amber-200 dark:border-amber-800">
              <div className="flex items-start">
                <FaInfoCircle className="h-4 w-4 text-amber-500 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300">About YouTube API Quotas:</p>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    <li>YouTube provides a limited number of API calls per day (quota)</li>
                    <li>This quota resets at midnight Pacific Time (GMT-8)</li>
                    <li>We're using cached data to minimize the impact</li>
                    <li>Video uploads use a different quota than display operations</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {dailyQuotaExceeded && (
              <div className="mt-4 flex flex-col sm:flex-row sm:justify-between">
                <div className="flex items-center text-amber-700 dark:text-amber-300 mb-2 sm:mb-0">
                  <FaHistory className="mr-2" />
                  <span>Quota will reset around {getQuotaResetTime()}</span>
                </div>
                <button
                  onClick={resetQuotaExceeded}
                  className="px-3 py-1 bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200 rounded hover:bg-amber-300 dark:hover:bg-amber-600 transition-colors"
                >
                  Try Again Now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 