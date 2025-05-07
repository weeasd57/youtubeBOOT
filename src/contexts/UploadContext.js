'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useDrive } from './DriveContext';

// Create context
const UploadContext = createContext(null);

// Provider component
export function UploadProvider({ children }) {
  const { data: session } = useSession();
  const { fetchDriveFiles, selectedFile, clearSelectedFile } = useDrive();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadingFileId, setUploadingFileId] = useState(null);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [autoUploadEnabled, setAutoUploadEnabled] = useState(false);
  const [error, setError] = useState(null);

  // Upload selected video to YouTube
  const uploadToYouTube = useCallback(async () => {
    if (!selectedFile) {
      setUploadStatus({ success: false, message: 'Please select a file first' });
      return;
    }

    if (!title) {
      setUploadStatus({ success: false, message: 'Please enter a title' });
      return;
    }

    try {
      setLoading(true);
      setUploadStatus(null);
      setError(null);
      setUploadingFileId(selectedFile.id);
      setUploadComplete(false);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: selectedFile.id,
          title,
          description,
        }),
      });

      const data = await response.json();
      setUploadComplete(true);
      
      if (response.ok) {
        setUploadStatus({
          success: true,
          message: 'Video uploaded successfully!',
          videoUrl: data.videoUrl,
        });
        setTitle('');
        setDescription('');
        clearSelectedFile();
      } else {
        setUploadStatus({
          success: false,
          message: `Upload failed: ${data.error}`,
        });
        setError(data.error || 'Upload failed');
      }
    } catch (error) {
      setUploadStatus({
        success: false,
        message: `Error: ${error.message}`,
      });
      setError(error.message);
      setUploadComplete(true);
    } finally {
      setLoading(false);
    }
  }, [selectedFile, title, description, clearSelectedFile]);

  // Process multiple videos (bulk upload) from the last 24 hours
  const uploadMultipleVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setUploadStatus(null);
      
      const response = await fetch('/api/auto-upload-videos');
      const data = await response.json();
      
      if (response.ok && data.results && data.results.length > 0) {
        setUploadStatus({
          success: true,
          message: `Successfully processed ${data.results.length} videos`,
          results: data.results,
          isBulkUpload: true
        });
        // Refresh the file list
        fetchDriveFiles();
      } else {
        setUploadStatus({
          success: true,
          message: data.message || 'No videos found to process',
        });
      }
    } catch (error) {
      console.error('Error in bulk upload:', error);
      setError(`Error in bulk upload: ${error.message}`);
      setUploadStatus({
        success: false,
        message: `Error in bulk upload: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  }, [fetchDriveFiles]);

  // Check for new videos and auto-upload
  const checkNewVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/check-new-videos');
      const data = await response.json();
      
      if (response.ok && data.results && data.results.length > 0) {
        setUploadStatus({
          success: true,
          message: `Auto-uploaded ${data.results.length} videos`,
          results: data.results,
        });
        // Refresh the file list
        fetchDriveFiles();
      } else {
        setUploadStatus({
          success: true,
          message: 'No new videos found for auto-upload',
        });
      }
    } catch (error) {
      console.error('Error in auto-upload:', error);
      setError(`Error in auto-upload: ${error.message}`);
      setUploadStatus({
        success: false,
        message: `Error in auto-upload: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  }, [fetchDriveFiles]);

  // Toggle auto-upload setting
  const toggleAutoUpload = () => {
    setAutoUploadEnabled(prev => !prev);
  };

  // Reset upload status
  const resetUploadStatus = () => {
    setUploadStatus(null);
    setUploadingFileId(null);
    setUploadComplete(false);
  };

  const value = {
    title,
    setTitle,
    description,
    setDescription,
    loading,
    uploadStatus,
    uploadingFileId,
    uploadComplete,
    autoUploadEnabled,
    error,
    uploadToYouTube,
    checkNewVideos,
    toggleAutoUpload,
    resetUploadStatus,
  };

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

// Custom hook for using the context
export function useUpload() {
  const context = useContext(UploadContext);
  if (context === null) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
} 