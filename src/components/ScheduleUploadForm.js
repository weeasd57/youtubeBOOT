'use client';

import { useState, useEffect } from 'react';
import { FaClock, FaCalendarAlt, FaBolt } from 'react-icons/fa';
import { useScheduledUploads } from '@/contexts/ScheduledUploadsContext';


export default function ScheduleUploadForm({ file, onScheduled, onCancel }) {
  const [title, setTitle] = useState(file ? file.name.replace('.mp4', '') : '');
  const [description, setDescription] = useState('');
  const [scheduledDateTime, setScheduledDateTime] = useState(() => {
    // Set default date to tomorrow at current time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 16); // Format for datetime-local input: YYYY-MM-DDThh:mm
  });
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [formattedScheduledTime, setFormattedScheduledTime] = useState('');
  
  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Update formatted scheduled time when scheduledDateTime changes
  useEffect(() => {
    if (scheduledDateTime) {
      const date = new Date(scheduledDateTime);
      setFormattedScheduledTime(formatDateTime(date));
    }
  }, [scheduledDateTime]);
  
  const { scheduleUpload, loading } = useScheduledUploads();
  const [error, setError] = useState(null);
  
  // Function to set date and time to current moment
  const setToNow = () => {
    // Create a fresh Date object to ensure we get the exact current time
    const now = new Date();
    
    // Format with explicit padding to ensure correct datetime-local format
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    // Set the datetime in the required format: YYYY-MM-DDThh:mm
    setScheduledDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    
    // Also update the current time display to match
    setCurrentDateTime(now);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file to upload');
      return;
    }
    
    if (!title) {
      setError('Please enter a title');
      return;
    }
    
    if (!scheduledDateTime) {
      setError('Please select a date and time');
      return;
    }
    
    const scheduledTime = new Date(scheduledDateTime).toISOString();
    
    const result = await scheduleUpload({
      fileId: file.id,
      fileName: file.name,
      title,
      description,
      scheduledTime,
    });
    
    if (result.success) {
      if (onScheduled) onScheduled(result.data);
    } else {
      setError(result.error || 'Failed to schedule upload');
    }
  };
  
  // Format date and time in a user-friendly way (reusable function)
  const formatDateTime = (date) => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };
  
  // Format the current date and time
  const formatCurrentDateTime = () => {
    return formatDateTime(currentDateTime);
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <FaClock className="text-blue-500" />
        <h2 className="text-xl font-semibold dark:text-white">Schedule Upload</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-md">
            {error}
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File</label>
          <div className="p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700">
            <p className="text-gray-900 dark:text-white font-medium truncate">{file?.name || 'No file selected'}</p>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Video title (#Shorts will be added automatically)"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="3"
            placeholder="Video description"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <div className="flex items-center gap-1">
              <FaCalendarAlt className="text-gray-500" />
              <span>Schedule Date & Time</span>
            </div>
          </label>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={scheduledDateTime}
              onChange={(e) => setScheduledDateTime(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="button"
              onClick={setToNow}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-1"
              title="Set to current time"
            >
              <FaBolt className="text-yellow-500" />
              <span>Now</span>
            </button>
          </div>
          {formattedScheduledTime && (
            <div className="mt-2 flex items-center gap-2">
              <FaCalendarAlt className="text-blue-500 text-sm" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Scheduled for: <span className="font-medium">{formattedScheduledTime}</span>
              </p>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <FaClock className="text-gray-500 text-sm" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Current time: <span className="font-medium">{formatCurrentDateTime()}</span>
            </p>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Select a future date and time when you want this video to be uploaded
          </p>
        </div>
        
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-r-2 border-white"></span>
                <span>Scheduling...</span>
              </>
            ) : (
              <>Schedule Upload</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 