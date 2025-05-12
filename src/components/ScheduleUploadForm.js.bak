'use client';

import { useState, useEffect } from 'react';
import { FaClock, FaCalendarAlt, FaBolt, FaTrash, FaYoutube, FaEdit, FaCheck, FaSync, FaLayerGroup } from 'react-icons/fa';
import { useScheduledUploads } from '@/contexts/ScheduledUploadsContext';
import Image from 'next/image';

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

  const { scheduleUpload, loading } = useScheduledUploads();

  const getDefaultScheduledTime = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const offset = tomorrow.getTimezoneOffset() * 60000;
    const localTomorrow = new Date(tomorrow.getTime() - offset);
    return localTomorrow.toISOString().slice(0, 16);
  };

  useEffect(() => {
    if (multipleFiles.length > 0) {
      const initialData = multipleFiles.map(f => ({
        fileId: f.id,
        fileName: f.name,
        thumbnailLink: f.thumbnailLink || null,
        title: f.name.replace(/\.mp4$/i, ''),
        description: '',
        selected: true,
        scheduledDateTime: getDefaultScheduledTime(), // Individual schedule time
        rowError: null, // For row-specific errors
      }));
      setFilesData(initialData);
    } else if (file) { 
      setFilesData([{
        fileId: file.id,
        fileName: file.name,
        thumbnailLink: file.thumbnailLink || null,
        title: file.name.replace(/\.mp4$/i, ''),
        description: '',
        selected: true,
        scheduledDateTime: getDefaultScheduledTime(),
        rowError: null,
      }]);
    } else {
      setFilesData([]);
    }
  }, [multipleFiles, file]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDisplayTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleInputChange = (index, field, value) => {
    setFilesData(prevData => {
      const newData = [...prevData];
      newData[index] = { ...newData[index], [field]: value, rowError: null }; // Clear row error on input change
      return newData;
    });
    // Clear global validation error when any input changes, as it will be re-evaluated
    setValidationError(null); 
    setGeneralError(null);
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

  // Modified function to apply staggered scheduling based on custom start hour and interval
  const applyStaggeredScheduling = () => {
    if (filesData.length === 0) return;
    
    // Create a base date that's today with custom start hour and minutes/seconds set to 00:00
    const now = new Date();
    const baseDate = new Date(now);
    baseDate.setHours(startHour); // Use the custom start hour
    baseDate.setMinutes(0);
    baseDate.setSeconds(0);
    
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
    <div className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-xl max-w-full border border-blue-100 dark:border-gray-700 transition-all p-1">
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

        {/* Batch operations panel - always visible now */}
        <div className="mx-4">
          <div className="bg-blue-50 dark:bg-gray-700/50 border border-blue-100 dark:border-gray-600 rounded-lg p-4 mb-4 space-y-4">
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
                        className="w-20 px-2 py-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                        className="w-20 px-2 py-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                    : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                } rounded-lg border shadow-sm p-4 transition-all`}
              >
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Video thumbnail and info */}
                  <div className="flex items-center sm:w-[200px]">
                    <div className="h-14 w-20 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden flex items-center justify-center shadow-sm">
                      {video.thumbnailLink ? (
                        <Image src={video.thumbnailLink} alt={video.fileName} width={80} height={56} className="object-cover h-full w-full" />
                      ) : (
                        <FaYoutube className="text-red-500 text-2xl" /> 
                      )}
                    </div>
                    <div className="ml-3">
                      <div className="text-xs font-medium text-gray-800 dark:text-white truncate max-w-[120px]" title={video.fileName}>
                        {video.fileName}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(video.fileId)}
                        className="mt-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs flex items-center gap-1 hover:underline"
                      >
                        <FaTrash size={10} /> Remove
                      </button>
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
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-gray-700 dark:text-white transition-all ${video.rowError && video.rowError.includes('Title') ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'}`}
                        placeholder="Video Title"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                      <textarea
                        value={video.description}
                        onChange={(e) => handleInputChange(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                        rows="1" 
                        placeholder="Description (optional)"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Schedule Time</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="datetime-local"
                          value={video.scheduledDateTime}
                          onChange={(e) => handleInputChange(index, 'scheduledDateTime', e.target.value)}
                          className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-gray-700 dark:text-white transition-all ${video.rowError && video.rowError.includes('Schedule time') ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'}`}
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
        
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-b-xl border-t border-gray-200 dark:border-gray-700 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors shadow-sm"
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