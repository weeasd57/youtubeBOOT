'use client';

import { useState, useEffect } from 'react';
import { FaClock, FaCalendarAlt, FaBolt, FaTrash, FaEdit, FaCheck, FaSync, FaLayerGroup, FaHashtag, FaCalendarCheck, FaRegCalendar, FaRegCalendarAlt } from 'react-icons/fa';
import { useScheduledUploads } from '@/contexts/ScheduledUploadsContext';
import Image from 'next/image';
import { Tooltip } from "@/components/ui/tooltip";
import { TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import DriveThumbnail from '@/components/DriveThumbnail';
import { processVideoTitle, generateCleanTitleFromFileName } from '@/utils/titleHelpers';

// Add a custom app logo component for consistency
const AppLogoIcon = ({ className = "", size = 24 }) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    <Image 
      src="/android-chrome-192x192.png" 
      alt="App Logo"
      fill
      className="object-cover"
    />
  </div>
);

// Helper function to extract hashtags from text
const extractHashtags = (text) => {
  if (!text) return [];
  
  // For TikTok videos, extract the part after the ID
  let processedText = text;
  const tiktokMatch = text.match(/tiktok-(\d+)-(.+?)\.mp4$/i);
  if (tiktokMatch) {
    processedText = tiktokMatch[2];
  }
  
  // Match hashtags (words starting with # followed by letters/numbers)
  const hashtagRegex = /#[a-zA-Z0-9_]+/g;
  const matches = processedText.match(hashtagRegex) || [];
  
  // Also extract potential hashtags (words without the # symbol)
  const potentialTags = processedText
    .split(/[\s_-]+/)
    .filter(word => 
      // Only include words that look like hashtags (all lowercase, 3+ chars)
      word.length >= 3 && 
      /^[a-z0-9_]+$/i.test(word) && 
      !['fyp', 'foryou', 'foryoupage', 'tiktok', 'video'].includes(word.toLowerCase())
    )
    .map(word => `#${word.toLowerCase()}`);
  
  // Combine both types of hashtags
  const allTags = [...matches, ...potentialTags];
  
  // Return unique hashtags
  return [...new Set(allTags)];
};

// Helper function to get the next available time (tomorrow at noon)
const getNextAvailableTime = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(12, 0, 0, 0); // Set to noon tomorrow
  return tomorrow;
};

// Helper function to initialize file data
const initializeFileData = (file) => {
  // استخدام بيانات TikTok إذا كانت موجودة
  const title = file.tiktokData?.title || generateCleanTitleFromFileName(file.name);
  const description = file.tiktokData?.description || '';
  const hashtags = file.tiktokData?.hashtags || extractHashtags(title);
  
  return {
    fileId: file.id,
    fileName: file.name,
    title: title.includes('#Shorts') ? title : `${title} #Shorts`,
    description: description,
    hashtags: hashtags,
    scheduledDateTime: getNextAvailableTime().toISOString().slice(0, 16),
    selected: true,
    rowError: null,
    thumbnailLink: file.thumbnailLink || null
  };
};

export default function ScheduleUploadForm({ file, multipleFiles = [], onScheduled, onCancel, onFileRemove }) {
  const [filesData, setFilesData] = useState([]);
  const [validationError, setValidationError] = useState(null);
  const [generalError, setGeneralError] = useState(null);
  const [currentDisplayTime, setCurrentDisplayTime] = useState(new Date()); // For displaying current time reference
  
  // New state for batch operations
  const [hourInterval, setHourInterval] = useState(6);
  const [startHour, setStartHour] = useState(new Date().getHours()); // Default to current hour
  const [batchTitle, setBatchTitle] = useState('');
  const [batchDescription, setBatchDescription] = useState('');
  const [showBatchOptions, setShowBatchOptions] = useState(true); // Set to true by default to always show batch tools
  const [simpleTimeFormat, setSimpleTimeFormat] = useState({}); // Track which rows use simple time format
  const [schedulingInfo, setSchedulingInfo] = useState(null);
  const [processedTitlePreviews, setProcessedTitlePreviews] = useState({});

  const { scheduleUpload, loading } = useScheduledUploads();

  const getDefaultScheduledTime = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const offset = tomorrow.getTimezoneOffset() * 60000;
    const localTomorrow = new Date(tomorrow.getTime() - offset);
    return localTomorrow.toISOString().slice(0, 16);
  };

  useEffect(() => {
    if (file) {
      setFilesData([initializeFileData(file)]);
    } else if (multipleFiles && multipleFiles.length > 0) {
      setFilesData(multipleFiles.map(file => initializeFileData(file)));
    }
  }, [file, multipleFiles]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDisplayTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleInputChange = (index, field, value) => {
    setFilesData(prevData => {
      const newData = [...prevData];
      newData[index] = { ...newData[index], [field]: value, rowError: null }; // Clear row error on input change
      
      if (field === 'title' && value.length > 100) {
        const processedTitle = processVideoTitle(value);
        setProcessedTitlePreviews(prev => ({
          ...prev,
          [index]: processedTitle
        }));
      } else if (field === 'title') {
        setProcessedTitlePreviews(prev => {
          const newPreviews = { ...prev };
          delete newPreviews[index];
          return newPreviews;
        });
      }
      
      return newData;
    });
    // Clear global validation error when any input changes, as it will be re-evaluated
    setValidationError(null); 
    setGeneralError(null);
  };

  // New function to add hashtags to description
  const addHashtagsToDescription = (index) => {
    setFilesData(prevData => {
      const newData = [...prevData];
      const file = newData[index];
      
      // Extract hashtags from title
      const titleHashtags = extractHashtags(file.title);
      
      // Combine with existing hashtags
      const allHashtags = [...new Set([...file.hashtags, ...titleHashtags])];
      
      // Create description with hashtags
      let description = file.description || '';
      
      // Remove existing hashtags at the end of description
      description = description.replace(/(\n\n)?#[a-zA-Z0-9_\s]+$/g, '');
      
      // Add hashtags if we have any
      if (allHashtags.length > 0) {
        description = description.trim() + '\n\n' + allHashtags.join(' ');
      }
      
      newData[index] = { 
        ...file, 
        description, 
        hashtags: allHashtags 
      };
      
      return newData;
    });
  };

  const handleRemoveFile = (fileIdToRemove) => {
    const newFilesData = filesData.filter(f => f.fileId !== fileIdToRemove);
    setFilesData(newFilesData);
    if (onFileRemove) {
      onFileRemove(fileIdToRemove);
    }
    if (newFilesData.length === 0) {
        if (onCancel) onCancel();
    }
  };
  
  const setToNowForRow = (index) => {
    const now = new Date();
    // Format with timezone handling
    const offset = now.getTimezoneOffset() * 60000;
    const localNow = new Date(now.getTime() - offset);
    const formattedDateTime = localNow.toISOString().slice(0, 16);
    handleInputChange(index, 'scheduledDateTime', formattedDateTime);
  };

  // Parse simple time format like "3pm" or "15:30" 
  const parseSimpleTime = (timeStr, index) => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let hours = 0;
      let minutes = 0;
      
      // Clean input
      const cleanTime = timeStr.trim().toLowerCase();
      
      // Check AM/PM
      const isPM = cleanTime.includes('pm');
      const cleanerTime = cleanTime.replace(/am|pm/g, '').trim();
      
      // Check hour:minute format
      if (cleanerTime.includes(':')) {
        const [hoursStr, minsStr] = cleanerTime.split(':');
        hours = parseInt(hoursStr);
        minutes = parseInt(minsStr) || 0;
      } else {
        hours = parseInt(cleanerTime);
        minutes = 0;
      }
      
      // Convert 12-hour to 24-hour
      if (isPM && hours < 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      
      // Apply time to current date
      today.setHours(hours, minutes, 0, 0);
      
      // Check if time is in the past, schedule for tomorrow if so
      if (today < now) {
        today.setDate(today.getDate() + 1);
      }
      
      // Handle timezone offset
      const offset = today.getTimezoneOffset() * 60000;
      const localDate = new Date(today.getTime() - offset);
      const formattedDateTime = localDate.toISOString().slice(0, 16);
      
      // Update state
      handleInputChange(index, 'scheduledDateTime', formattedDateTime);
    } catch (error) {
      console.error('Error parsing simple time format:', error);
      // Don't change value on error
    }
  };

  // Modified function to apply staggered scheduling based on custom start hour and interval
  // and display date information
  const applyStaggeredScheduling = () => {
    if (filesData.length === 0) return;
    
    // Create a base date that's today with custom start hour and minutes/seconds set to 00:00
    const now = new Date();
    const baseDate = new Date(now);
    baseDate.setHours(startHour); // Use the custom start hour
    baseDate.setMinutes(0);
    baseDate.setSeconds(0);
    
    // Calculate the end date
    const lastIndex = filesData.length - 1;
    const endDate = new Date(baseDate);
    // Add the total hours for the last video
    endDate.setHours(baseDate.getHours() + (lastIndex * hourInterval));
    
    // Calculate total days between start and end date
    const daysDifference = Math.floor((endDate - baseDate) / (1000 * 60 * 60 * 24));
    
    // Show summary info for multiple videos
    if (filesData.length > 1) {
      const infoMessage = `Scheduling ${filesData.length} videos from ${baseDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} (${daysDifference} day${daysDifference !== 1 ? 's' : ''} total)`;
      setGeneralError(null); // Clear any previous errors
      // Use state to show scheduling info
      setSchedulingInfo({
        startDate: baseDate.toLocaleDateString(),
        endDate: endDate.toLocaleDateString(),
        daysDifference,
        totalVideos: filesData.length
      });
    } else {
      setSchedulingInfo(null);
    }
    
    // Apply the staggered times
    setFilesData(prevData => {
      return prevData.map((file, index) => {
        // Clone the base date for this file
        const fileDate = new Date(baseDate);
        // Add the specified hour interval for each subsequent file
        fileDate.setHours(baseDate.getHours() + (index * hourInterval));
        
        // Handle timezone offset correctly
        const offset = fileDate.getTimezoneOffset() * 60000;
        const localFileDate = new Date(fileDate.getTime() - offset);
        
        return {
          ...file,
          scheduledDateTime: localFileDate.toISOString().slice(0, 16)
        };
      });
    });
  };

  // New function to apply the same title to all files
  const applyBatchTitle = () => {
    if (!batchTitle.trim()) return;
    
    setFilesData(prevData => {
      return prevData.map(file => ({
        ...file,
        title: batchTitle
      }));
    });
  };

  // New function to apply the same description to all files
  const applyBatchDescription = () => {
    if (!batchDescription.trim()) return;
    
    setFilesData(prevData => {
      return prevData.map(file => ({
        ...file,
        description: batchDescription
      }));
    });
  };

  const validateForm = () => {
    let isValid = true;
    let globalErrorMsg = '';
    const updatedFilesData = filesData.map(video => {
      let rowError = null;
      if (!video.title.trim()) {
        rowError = 'Title is required.';
        isValid = false;
      }
      if (!video.scheduledDateTime) {
        rowError = (rowError ? rowError + ' ' : '') + 'Schedule time is required.';
        isValid = false;
      } else {
        const scheduledDate = new Date(video.scheduledDateTime);
        if (scheduledDate <= new Date(Date.now() - 60000)) { // Allow 1 min buffer for submission
          rowError = (rowError ? rowError + ' ' : '') + 'Time must be in future.';
          isValid = false;
        }
      }
      return { ...video, rowError };
    });

    setFilesData(updatedFilesData);

    if (!isValid) {
        // Check if any specific row error was the first one encountered for global message
        const firstErrorRow = updatedFilesData.find(v => v.rowError);
        if (firstErrorRow) {
            globalErrorMsg = `Error with ${firstErrorRow.fileName}: ${firstErrorRow.rowError} (and possibly others).`;
        } else {
            globalErrorMsg = 'Please correct the errors in the form.';
        }
        setValidationError(globalErrorMsg);
    }
     else {
        setValidationError(null);
    }
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError(null);
    if (!validateForm()) {
      return;
    }

    const uploadsToAttempt = filesData.filter(f => f.selected);

    if (uploadsToAttempt.length === 0) {
        setGeneralError("No files selected for upload.");
        return;
    }

    try {
      // Process uploads one by one to give better feedback or handle partial failures
      let successfulUploads = 0;
      let failedUploads = [];

      for (const videoData of uploadsToAttempt) {
        const result = await scheduleUpload({
          fileId: videoData.fileId,
          fileName: videoData.fileName,
          title: videoData.title,
          description: videoData.description,
          scheduledTime: new Date(videoData.scheduledDateTime).toISOString(),
        });
        if (result && result.success !== false) { // Check if scheduleUpload returns a success indicator
            successfulUploads++;
        } else {
            failedUploads.push({name: videoData.fileName, error: (result && result.error) || 'Unknown error'});
            // Update rowError for the specific file that failed
            setFilesData(prev => prev.map(f => f.fileId === videoData.fileId ? {...f, rowError: `Schedule failed: ${(result && result.error) || 'Unknown'}`} : f));
        }
      }

      if (failedUploads.length > 0) {
        setGeneralError(`Scheduled ${successfulUploads} video(s). Failed to schedule ${failedUploads.length} video(s). Check errors below.`);
      } else if (successfulUploads > 0) {
        if (onScheduled) {
          onScheduled({ count: successfulUploads }); // Pass back success count
        }
      } else {
        setGeneralError('No videos were scheduled. Please try again.');
      }

    } catch (error) {
      console.error('Error scheduling uploads:', error);
      setGeneralError(error.message || 'An unexpected error occurred during scheduling.');
    }
  };

  const formatDateTimeForDisplay = (isoString) => {
    if (!isoString) return 'Not set';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    });
  };

  const formatCurrentDateTime = () => {
    return currentDisplayTime.toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
    });
  };

  if (!filesData.length) {
    if (multipleFiles.length === 0 && !file) {
        return <p className="text-gray-600 dark:text-gray-400">No files selected for scheduling.</p>;
    }
    return null; 
  }

  return (
    <div className="bg-gradient-to-br from-white to-blue-50 dark:from-black dark:to-black rounded-xl shadow-xl max-w-full border border-blue-100 dark:border-gray-700 transition-all p-1">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-blue-600 dark:bg-blue-700 text-white p-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-lg sm:text-2xl font-bold flex items-center">
              <FaCalendarAlt className="mr-3 text-white" />
              Schedule Uploads
              <span className="ml-3 px-3 py-1 bg-white text-blue-600 text-xs font-bold rounded-full flex items-center">
                {filesData.length} {filesData.length === 1 ? 'video' : 'videos'}
              </span>
            </h3>
            <p className="text-xs text-blue-100">
              {formatCurrentDateTime()}
            </p>
          </div>
        </div>

        {validationError && (
          <div className="mx-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-md text-sm animate-pulse">
            {validationError}
          </div>
        )}
        
        {generalError && (
          <div className="mx-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-md text-sm animate-pulse">
            {generalError}
          </div>
        )}

        {/* Show scheduling info when multiple videos are selected */}
        {schedulingInfo && (
          <div className="mx-4 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-md text-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <div className="flex items-center">
                <FaCalendarCheck className="mr-2 text-blue-600 dark:text-blue-400" />
                <span className="font-semibold">Scheduling {schedulingInfo.totalVideos} videos</span>
              </div>
              <div className="flex items-center">
                <FaRegCalendar className="mr-2 text-blue-600 dark:text-blue-400" />
                <span>Start: {schedulingInfo.startDate}</span>
              </div>
              <div className="flex items-center">
                <FaRegCalendarAlt className="mr-2 text-blue-600 dark:text-blue-400" />
                <span>End: {schedulingInfo.endDate}</span>
              </div>
              <div className="flex items-center">
                <FaClock className="mr-2 text-blue-600 dark:text-blue-400" />
                <span>Duration: {schedulingInfo.daysDifference} day{schedulingInfo.daysDifference !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        )}

        {/* Batch operations panel - always visible now */}
        <div className="mx-4">
          <div className="bg-blue-50 dark:bg-black border border-blue-100 dark:border-gray-600 rounded-lg p-4 mb-4 space-y-4">
            <div>
              <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Staggered Scheduling</h4>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="sm:flex-1 flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Hour (24h)</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min="0" 
                        max="23"
                        value={startHour} 
                        onChange={(e) => setStartHour(parseInt(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-gray-200 dark:border-gray-600 dark:bg-black dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">:00</span>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          setStartHour(now.getHours());
                        }}
                        className="px-3 py-2 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                        title="Set to current hour"
                      >
                        <FaBolt size={10} className="animate-pulse" /> Now
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Hours Between Videos</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min="1" 
                        max="24"
                        value={hourInterval} 
                        onChange={(e) => {
                          const value = e.target.value;
                          const parsed = parseInt(value);
                          if (!isNaN(parsed) && parsed >= 1) {
                            setHourInterval(parsed);
                          } else if (value === '') {
                            setHourInterval(6); // Default to 6 only when input is empty
                          }
                        }}
                        className="w-20 px-2 py-1 border border-gray-200 dark:border-gray-600 dark:bg-black dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">hours</span>
                    </div>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={applyStaggeredScheduling}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg flex items-center gap-1.5 transition-colors self-end"
                >
                  <FaSync /> Apply Interval
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Set Title For All Videos</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={batchTitle} 
                    onChange={(e) => setBatchTitle(e.target.value)}
                    placeholder="Common title for all videos"
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-black dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={applyBatchTitle}
                    disabled={!batchTitle.trim()}
                    className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaCheck /> Apply
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Set Description For All Videos</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={batchDescription} 
                    onChange={(e) => setBatchDescription(e.target.value)}
                    placeholder="Common description for all videos"
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-black dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={applyBatchDescription}
                    disabled={!batchDescription.trim()}
                    className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaCheck /> Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-2">
          <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-1">
            {filesData.map((video, index) => (
              <div 
                key={video.fileId} 
                className={`${
                  video.rowError 
                    ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' 
                    : 'bg-white border-gray-200 dark:bg-black dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                } rounded-lg border shadow-sm p-4 transition-all`}
              >
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Video thumbnail and info */}
                  <div className="flex items-center sm:w-[200px]">
                    <div className="h-14 w-20 bg-gray-100 dark:bg-black rounded-md overflow-hidden flex items-center justify-center shadow-sm">
                      {video.thumbnailLink ? (
                        <DriveThumbnail 
                          src={video.thumbnailLink} 
                          alt={video.fileName} 
                          width={80} 
                          height={56} 
                          fallbackText={video.fileName}
                          className="h-full w-full" 
                        />
                      ) : (
                        <AppLogoIcon className="text-red-500 text-2xl" /> 
                      )}
                    </div>
                    <div className="ml-3">
                      <div className="text-xs font-medium text-gray-800 dark:text-white truncate max-w-[120px]" title={video.fileName}>
                        {generateCleanTitleFromFileName(video.fileName)}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(video.fileId)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs flex items-center gap-1 hover:underline"
                        >
                          <FaTrash size={10} /> Remove
                        </button>
                        {video.hashtags && video.hashtags.length > 0 && (
                          <span className="text-xs text-blue-500 dark:text-blue-400 flex items-center gap-1 ml-2">
                            <FaHashtag size={10} /> {video.hashtags.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Form fields */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                      <input
                        type="text"
                        value={video.title}
                        onChange={(e) => handleInputChange(index, 'title', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-black dark:text-white transition-all ${video.rowError && video.rowError.includes('Title') ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'}`}
                        placeholder="Video Title"
                      />
                      {processedTitlePreviews[index] && (
                        <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                          <span className="font-semibold">تنبيه:</span> العنوان طويل جدًا (أكثر من 100 حرف). سيتم اختصاره إلى:
                          <div className="p-2 mt-1 bg-amber-50 dark:bg-amber-900/30 rounded border border-amber-200 dark:border-amber-800">
                            {processedTitlePreviews[index]}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <button
                          type="button"
                          onClick={() => addHashtagsToDescription(index)}
                          className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 mb-1"
                          title="Add hashtags from title to description"
                        >
                          <FaHashtag size={10} /> Add Hashtags
                        </button>
                      </div>
                      <textarea
                        value={video.description}
                        onChange={(e) => handleInputChange(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-black dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                        rows="2" 
                        placeholder="Description (optional)"
                      />
                      {video.hashtags && video.hashtags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {video.hashtags.map((tag, tagIndex) => (
                            <span 
                              key={tagIndex} 
                              className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Schedule Time</label>
                     
                      <div className="flex items-center gap-2">
                        <input
                          type="datetime-local"
                          value={video.scheduledDateTime}
                          onChange={(e) => handleInputChange(index, 'scheduledDateTime', e.target.value)}
                          className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-black dark:text-white transition-all ${video.rowError && video.rowError.includes('Schedule time') ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'}`}
                        />
                        <button
                          type="button"
                          onClick={() => setToNowForRow(index)}
                          className="px-3 py-2 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                          title="Set to current time"
                        >
                          <FaBolt size={10} className="animate-pulse" /> Now
                        </button>
                      </div>
                      
                      {video.scheduledDateTime && 
                        <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                          Scheduled for: {formatDateTimeForDisplay(video.scheduledDateTime)}
                        </p>
                      }
                      {video.rowError && (
                        <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                          {video.rowError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-black p-4 rounded-b-xl border-t border-gray-200 dark:border-gray-700 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || filesData.length === 0}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm transition-colors shadow-sm"
          >
            {loading ? (
              <FaClock className="animate-spin" /> 
            ) : (
              <FaCalendarAlt />
            )}
            Schedule {filesData.length > 0 ? filesData.length : ''} {filesData.length === 1 ? 'Video' : 'Videos'}
          </button>
        </div>
      </form>
    </div>
  );
} 