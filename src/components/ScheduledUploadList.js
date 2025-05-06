'use client';

import { FaClock, FaTrash, FaCheckCircle, FaTimes, FaSpinner } from 'react-icons/fa';
import { useScheduledUploads } from '@/contexts/ScheduledUploadsContext';
import { useState } from 'react';

export default function ScheduledUploadList() {
  const { 
    scheduledUploads, 
    loading,
    error, 
    refreshScheduledUploads,
    cancelScheduledUpload 
  } = useScheduledUploads();
  
  const [cancelingId, setCancelingId] = useState(null);
  
  const handleCancel = async (id) => {
    if (cancelingId) return; // Prevent multiple cancels
    
    setCancelingId(id);
    const result = await cancelScheduledUpload(id);
    setCancelingId(null);
    
    // The list will be refreshed by the context if successful
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  if (loading && scheduledUploads.length === 0) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <FaClock className="text-blue-500" />
          <h2 className="text-xl font-semibold dark:text-white">Scheduled Uploads</h2>
        </div>
        <div className="flex justify-center py-8">
          <FaSpinner className="animate-spin text-3xl text-blue-500" />
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <FaClock className="text-blue-500" />
          <h2 className="text-xl font-semibold dark:text-white">Scheduled Uploads</h2>
        </div>
        <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-md">
          {error}
        </div>
      </div>
    );
  }
  
  if (scheduledUploads.length === 0) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <FaClock className="text-blue-500" />
          <h2 className="text-xl font-semibold dark:text-white">Scheduled Uploads</h2>
        </div>
        <div className="p-6 text-center text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <p>No scheduled uploads</p>
          <p className="text-sm mt-1">Videos scheduled for upload will appear here</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <FaClock className="text-blue-500" />
          <h2 className="text-xl font-semibold dark:text-white">Scheduled Uploads</h2>
        </div>
        <button
          onClick={refreshScheduledUploads}
          disabled={loading}
          className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full"
          title="Refresh"
        >
          <FaSpinner className={`${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-md text-sm">
        <p>Scheduled uploads are processed once daily at 9:00 AM. Videos scheduled for upload may take up to 24 hours to be processed.</p>
      </div>
      
      <div className="space-y-3">
        {scheduledUploads.map((upload) => (
          <div
            key={upload.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">{upload.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{upload.file_name}</p>
              </div>
              
              {upload.status === 'pending' && (
                <button
                  onClick={() => handleCancel(upload.id)}
                  disabled={cancelingId === upload.id}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                  title="Cancel upload"
                >
                  {cancelingId === upload.id ? (
                    <FaSpinner className="animate-spin" />
                  ) : (
                    <FaTrash />
                  )}
                </button>
              )}
            </div>
            
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <div className="flex items-center gap-1">
                <FaClock className="text-gray-400 dark:text-gray-500" />
                <span className="text-gray-600 dark:text-gray-300">
                  Scheduled for: {formatDate(upload.scheduled_time)}
                </span>
              </div>
              
              <div className="flex items-center gap-1">
                <span
                  className={
                    upload.status === 'pending'
                      ? 'text-yellow-500'
                      : upload.status === 'completed'
                      ? 'text-green-500'
                      : 'text-red-500'
                  }
                >
                  {upload.status === 'pending' ? (
                    <FaClock />
                  ) : upload.status === 'completed' ? (
                    <FaCheckCircle />
                  ) : (
                    <FaTimes />
                  )}
                </span>
                <span
                  className={
                    upload.status === 'pending'
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : upload.status === 'completed'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }
                >
                  {upload.status.charAt(0).toUpperCase() + upload.status.slice(1)}
                </span>
              </div>
            </div>
            
            {upload.status === 'completed' && upload.youtube_url && (
              <div className="mt-2">
                <a
                  href={upload.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400 text-sm"
                >
                  View on YouTube
                </a>
              </div>
            )}
            
            {upload.status === 'failed' && upload.error_message && (
              <div className="mt-2 text-sm text-red-500 dark:text-red-400">
                Error: {upload.error_message}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 