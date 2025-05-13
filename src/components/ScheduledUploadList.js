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
      <div className="p-6 bg-white dark:bg-black rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300">
        <div className="flex items-center gap-2 mb-4">
          <FaClock className="text-amber-500" />
          <h2 className="text-xl font-semibold dark:text-amber-50">Scheduled Uploads</h2>
        </div>
        <div className="flex justify-center py-8">
          <FaSpinner className="animate-spin text-3xl text-blue-500 dark:text-amber-500" />
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6 bg-white dark:bg-black rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300">
        <div className="flex items-center gap-2 mb-4">
          <FaClock className="text-amber-500" />
          <h2 className="text-xl font-semibold dark:text-amber-50">Scheduled Uploads</h2>
        </div>
        <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-md border dark:border-red-800/20">
          {error}
        </div>
      </div>
    );
  }
  
  if (scheduledUploads.length === 0) {
    return (
      <div className="p-6 bg-white dark:bg-black rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300">
        <div className="flex items-center gap-2 mb-4">
          <FaClock className="text-amber-500" />
          <h2 className="text-xl font-semibold dark:text-amber-50">Scheduled Uploads</h2>
        </div>
        <div className="p-6 text-center text-gray-500 dark:text-amber-200/60 border border-dashed border-gray-300 dark:border-amber-700/40 rounded-lg">
          <p>No scheduled uploads</p>
          <p className="text-sm mt-1">Videos scheduled for upload will appear here</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 bg-white dark:bg-black rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <FaClock className="text-amber-500" />
          <h2 className="text-xl font-semibold dark:text-amber-50">Scheduled Uploads</h2>
        </div>
        <button
          onClick={refreshScheduledUploads}
          disabled={loading}
          className="p-2 text-blue-500 dark:text-amber-400 hover:bg-blue-50 dark:hover:bg-amber-900/20 rounded-full transition-all duration-300 transform hover:rotate-12"
          title="Refresh"
        >
          <FaSpinner className={`${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      <div className="space-y-3">
        {scheduledUploads.map((upload) => (
          <div
            key={upload.id}
            className="border border-gray-200 dark:border-amber-800/30 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-black/50 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-amber-50">{upload.title}</h3>
                <p className="text-sm text-gray-500 dark:text-amber-200/60 mt-1">{upload.file_name}</p>
              </div>
              
              {upload.status === 'pending' && (
                <button
                  onClick={() => handleCancel(upload.id)}
                  disabled={cancelingId === upload.id}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all duration-300"
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
                <FaClock className="text-gray-400 dark:text-amber-500/70" />
                <span className="text-gray-600 dark:text-amber-200/80">
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
                  className="text-blue-600 hover:underline dark:text-amber-400 text-sm"
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