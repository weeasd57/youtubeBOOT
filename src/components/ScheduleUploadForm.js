'use client';

import { useState, useEffect } from 'react';
import { FaClock, FaCalendarAlt, FaBolt, FaTrash, FaYoutube } from 'react-icons/fa';
import { useScheduledUploads } from '@/contexts/ScheduledUploadsContext';
import Image from 'next/image';

export default function ScheduleUploadForm({ file, multipleFiles = [], onScheduled, onCancel, onFileRemove }) {
  const [filesData, setFilesData] = useState([]);
  const [validationError, setValidationError] = useState(null);
  const [generalError, setGeneralError] = useState(null);
  const [currentDisplayTime, setCurrentDisplayTime] = useState(new Date()); // For displaying current time reference

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
    const offset = now.getTimezoneOffset() * 60000;
    const localNow = new Date(now.getTime() - offset);
    handleInputChange(index, 'scheduledDateTime', localNow.toISOString().slice(0, 16));
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
    <form onSubmit={handleSubmit} className="space-y-6 p-1 sm:p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div>
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
          Schedule Uploads ({filesData.length} {filesData.length === 1 ? 'video' : 'videos'})
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Current time: {formatCurrentDateTime()}
        </p>
      </div>

      {validationError && (
        <div className="p-3 mb-3 bg-red-100 border border-red-400 text-red-700 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700 rounded-md text-sm">
          {validationError}
        </div>
      )}
      {generalError && (
        <div className="p-3 mb-3 bg-red-100 border border-red-400 text-red-700 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700 rounded-md text-sm">
          {generalError}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[10%]">Video</th>
              <th scope="col" className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[40%]">Title</th>
              <th scope="col" className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[20%]">Description</th>
              <th scope="col" className="px-2 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[25%]">Schedule Time</th>
              <th scope="col" className="px-1 sm:px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[5%]">Act</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filesData.map((video, index) => (
              <tr key={video.fileId} className={video.rowError ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-16 bg-gray-200 dark:bg-gray-600 rounded overflow-hidden flex items-center justify-center">
                      {video.thumbnailLink ? (
                        <Image src={video.thumbnailLink} alt={video.fileName} width={64} height={40} className="object-cover h-full w-full" />
                      ) : (
                        <FaYoutube className="text-red-500 text-xl" /> 
                      )}
                    </div>
                    <div className="ml-2 sm:ml-3">
                      <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate w-24 sm:w-32 md:w-40" title={video.fileName}>
                        {video.fileName}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-2 sm:px-4 py-3">
                  <input
                    type="text"
                    value={video.title}
                    onChange={(e) => handleInputChange(index, 'title', e.target.value)}
                    className={`w-full px-2 py-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:text-white ${video.rowError && video.rowError.includes('Title') ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                    placeholder="Video Title"
                  />
                </td>
                <td className="px-2 sm:px-4 py-3">
                  <textarea
                    value={video.description}
                    onChange={(e) => handleInputChange(index, 'description', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                    rows="1" 
                    placeholder="Description"
                  />
                </td>
                <td className="px-2 sm:px-4 py-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
                    <input
                      type="datetime-local"
                      value={video.scheduledDateTime}
                      onChange={(e) => handleInputChange(index, 'scheduledDateTime', e.target.value)}
                      className={`w-full sm:flex-grow px-2 py-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:text-white ${video.rowError && video.rowError.includes('Schedule time') ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setToNowForRow(index)}
                      className="p-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center gap-1 self-start sm:self-center"
                      title="Set to current time"
                    >
                      <FaBolt size={10} /> Now
                    </button>
                  </div>
                   {video.scheduledDateTime && <p className='text-xs text-gray-400 mt-1 hidden sm:block'>Sched: {formatDateTimeForDisplay(video.scheduledDateTime)}</p>}
                   {video.rowError && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1">{video.rowError}</p>
                  )}
                </td>
                <td className="px-1 sm:px-2 py-3 whitespace-nowrap text-center text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(video.fileId)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
                    title="Remove this video"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="flex items-center justify-end space-x-2 sm:space-x-3 pt-3 sm:pt-4">
        <button
          type="button"
          onClick={onCancel} // This should probably clear selections and hide form via parent
          className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          Cancel All
        </button>
        <button
          type="submit"
          disabled={loading || filesData.length === 0}
          className="px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
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
  );
} 