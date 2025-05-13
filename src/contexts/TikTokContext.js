'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { getWithRetry } from '@/utils/apiHelpers';
import { toastHelper } from '@/components/ToastHelper';
import { fetchDriveFoldersWithCache } from '@/utils/driveHelpers';

// Create context
const TikTokContext = createContext();

// Provider component
export function TikTokProvider({ children }) {
  const [videos, setVideos] = useState([]);
  const [jsonData, setJsonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [progress, setProgress] = useState(0);
  const [driveFolderId, setDriveFolderId] = useState(null);
  const [saveToDrive, setSaveToDrive] = useState(true);
  const [folderName, setFolderName] = useState('TikTok Downloads');
  const [driveFolders, setDriveFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [jsonToastShown, setJsonToastShown] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingVideoIds, setDownloadingVideoIds] = useState([]);
  const { data: session } = useSession();

  // Function to fetch Google Drive folders - using useCallback to avoid dependency cycle
  const fetchDriveFolders = useCallback(async (options = {}) => {
    // Use the shared utility function
    const result = await fetchDriveFoldersWithCache({
      forceRefresh: options.forceRefresh || false,
      setLoadingState: setLoadingFolders,
      setFoldersState: setDriveFolders,
      onFolderCheck: (folders) => {
        // Check if the currently selected folder still exists
        if (driveFolderId) {
          const folderStillExists = folders.some(folder => folder.id === driveFolderId);
          if (!folderStillExists) {
            console.log(`Selected folder ${driveFolderId} no longer exists, resetting selection`);
            setDriveFolderId(null);
            toastHelper.warning(`The folder "${folderName}" is no longer available. Please select another folder.`);
          }
        }
      }
    });
    
    return result;
  }, [driveFolderId, folderName]);
  
  // Periodically check if selected folder still exists - helpful when folders are deleted in Drive
  useEffect(() => {
    if (!session || !driveFolderId) return;
    
    // Refresh folder list when the component first loads with a folder selected
    if (driveFolderId) {
      fetchDriveFolders();
    }
    
    // Check every 5 minutes if the folder still exists
    const intervalId = setInterval(() => {
      if (driveFolderId) {
        fetchDriveFolders();
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(intervalId);
  }, [session, driveFolderId, fetchDriveFolders]);

  // Check if a folder exists in Google Drive
  const checkFolderExists = async (folderId) => {
    if (!folderId || !session) return false;
    
    try {
      const response = await fetch(`/api/drive/check-folder?folderId=${folderId}`);
      
      if (!response.ok) {
        console.error(`Failed to check folder: ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      return data.exists;
    } catch (error) {
      console.error('Error checking if folder exists:', error);
      return false;
    }
  };

  // Verify folder existence before downloading
  const verifyFolderBeforeDownload = async () => {
    if (!driveFolderId || !saveToDrive) return true;
    
    // Check if the selected folder still exists
    const exists = await checkFolderExists(driveFolderId);
    
    if (!exists) {
      setDriveFolderId(null);
      toastHelper.warning(`The folder "${folderName}" is no longer available. Please select another folder.`);
      return false;
    }
    
    return true;
  };

  // Use existing folder
  const useExistingFolder = (folderId, folderName) => {
    // Special case: empty values are used to clear the current folder
    if (folderId === '' && folderName === '') {
      setDriveFolderId(null);
      return true;
    }
    
    // Regular validation for actual folder data
    if (!folderId || !folderName) {
      console.error('Invalid folder data provided:', { folderId, folderName });
      return false;
    }
    
    console.log(`Using existing Drive folder: ${folderName} (${folderId})`);
    setDriveFolderId(folderId);
    setFolderName(folderName);
    return true;
  };

  // Handle creating a new folder
  const createDriveFolder = async (customFolderName) => {
    try {
      // Use custom folder name if provided, otherwise use the state value
      const nameToUse = customFolderName || folderName;
      
      const response = await fetch('/api/drive/create-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderName: nameToUse }),
      });

      if (!response.ok) {
        console.error(`Failed to create folder: ${response.status}`);
        return null; // Return null instead of throwing
      }

      const data = await response.json();
      // Don't set the folder ID here, let the calling component decide when to use it
      // setDriveFolderId(data.folderId);
      
      // No need to refresh here - we'll handle the refresh in the component
      // that called this function to better control the UI state
      
      return data.folderId;
    } catch (error) {
      console.error('Error creating Drive folder:', error);
      return null; // Return null instead of throwing
    }
  };

  // Check if file exists in Google Drive
  const checkFileExistsInDrive = async (videoId) => {
    if (!videoId || !driveFolderId || !session) return false;
    
    try {
      const response = await fetch(`/api/drive/check-file-exists?folderId=${driveFolderId}&videoId=${videoId}`);
      
      if (!response.ok) {
        console.error(`Failed to check file existence: ${response.status}`);
        return { exists: false };
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking if file exists in Drive:', error);
      return { exists: false };
    }
  };

  // Upload file to Google Drive
  const uploadToDrive = async (videoFile, videoDetails) => {
    try {
      // Check if the file already exists in Drive
      const videoId = videoDetails.videoId;
      if (videoId) {
        const fileExists = await checkFileExistsInDrive(videoId);
        if (fileExists.exists) {
          console.log(`File already exists in Drive, skipping upload: ${fileExists.fileId}`);
          return { 
            success: true, 
            fileId: fileExists.fileId,
            fileName: fileExists.fileName,
            webViewLink: fileExists.webViewLink,
            alreadyExists: true
          };
        }
      }
      
      // Ensure we have a folder ID
      const folderId = driveFolderId || await createDriveFolder();
      
      // If folder creation failed, skip Drive upload
      if (!folderId) {
        console.warn('Skipping Drive upload due to folder creation failure');
        return { success: false, error: 'Could not create or access Drive folder' };
      }
      
      // Create form data for the file upload
      const formData = new FormData();
      formData.append('file', videoFile);
      formData.append('folderId', folderId);
      formData.append('title', videoDetails.title);
      formData.append('description', videoDetails.description || '');
      formData.append('originalUrl', videoDetails.originalUrl);
      formData.append('downloadUrl', videoDetails.downloadUrl);
      
      // Append videoId for consistent identification between Drive and Supabase
      if (videoDetails.videoId) {
        formData.append('videoId', videoDetails.videoId);
        // Include video ID in filename for easier identification
        const filename = videoFile.name.startsWith(`tiktok-${videoDetails.videoId}`) 
          ? videoFile.name 
          : `tiktok-${videoDetails.videoId}`;
        
        // Create a new file with the updated name
        const renamedFile = new File([videoFile], filename, { type: videoFile.type });
        // Replace the file in formData
        formData.delete('file');
        formData.append('file', renamedFile);
        
        console.log('Starting Drive upload for file:', filename, 'Size:', videoFile.size, 'Type:', videoFile.type, 'VideoID:', videoDetails.videoId);
      } else {
        console.log('Starting Drive upload for file:', videoFile.name, 'Size:', videoFile.size, 'Type:', videoFile.type);
      }
      
      const response = await fetch('/api/drive/upload-file', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        console.error(`Failed to upload file: ${response.status}`);
        
        try {
          const errorData = await response.json();
          console.error('Error details:', errorData);
          
          // Handle specific error codes
          if (response.status === 403 || errorData.status === 403 || errorData.errorCode === 'PERMISSION_DENIED') {
            toastHelper.error('Permission denied: Your Google account does not have permission to upload files to Drive.');
            return { 
              success: false, 
              error: errorData.error || 'Permission denied when uploading to Google Drive',
              errorCode: 'PERMISSION_DENIED'
            };
          }
          
          // Network errors
          if (errorData.errorCode === 'NETWORK_ERROR') {
            toastHelper.warning('Network error while uploading to Google Drive. Please check your internet connection and try again.');
            return {
              success: false,
              error: errorData.error || 'Network error',
              errorCode: 'NETWORK_ERROR'
            };
          }
          
          return { 
            success: false, 
            error: errorData.error || `Upload failed with status ${response.status}` 
          };
        } catch (parseError) {
          return { 
            success: false, 
            error: `Upload failed with status ${response.status}` 
          };
        }
      }

      const data = await response.json();
      console.log('Upload successful:', data);
      return { ...data, success: true };
    } catch (error) {
      console.error('Error uploading to Drive:', error);
      return { 
        success: false, 
        error: error.message || 'Upload failed due to an unexpected error' 
      };
    }
  };

  // Get download link from the API
  const getDownloadLink = async (tiktokUrl) => {
    try {
      console.log('Requesting download link for:', tiktokUrl);
      
      const response = await fetch('/api/tiktok-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: tiktokUrl }),
      });

      if (!response.ok) {
        console.error('API response not ok:', response.status);
        
        // If the service doesn't work, try direct download
        if (response.status === 404) {
          // Use alternative method - direct download
          return `/api/tiktok-direct-download?url=${encodeURIComponent(tiktokUrl)}`;
        }
        
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Got download URL:', data.downloadUrl);
      
      // If the API returned a fileSize, save it
      if (data.fileSize) {
        console.log('API returned file size:', data.fileSize);
      }
      
      return data.downloadUrl;
    } catch (error) {
      console.error('Error getting download link:', error);
      throw error;
    }
  };

  // Download video and save to Drive if enabled
  const downloadVideo = async (url, filename, videoDetails) => {
    try {
      // Set up progress tracking
      const videoId = videoDetails.videoId || extractVideoIdFromUrl(videoDetails.originalUrl);
      
      // Update video with progress at 0%
      setVideos(prev => 
        prev.map(v => v.id === videoDetails.id ? { 
          ...v, 
          progress: 0 
        } : v)
      );
      
      // Check if the file already exists in Drive
      if (saveToDrive && session && driveFolderId && videoId) {
        const fileExists = await checkFileExistsInDrive(videoId);
        if (fileExists.exists) {
          console.log(`File already exists in Drive with ID: ${fileExists.fileId}`);
          
          // Update video status to completed without downloading
          setVideos(prev => 
            prev.map(v => v.id === videoDetails.id ? { 
              ...v, 
              status: 'completed',
              progress: 100,
              driveFileId: fileExists.fileId,
              webViewLink: fileExists.webViewLink 
            } : v)
          );
          
          // Return without downloading anything
          return;
        }
      }
      
      // Make a HEAD request first to get content length without downloading
      try {
        const headResponse = await fetch(url, { method: 'HEAD' });
        if (headResponse.ok) {
          const contentLength = headResponse.headers.get('content-length');
          if (contentLength) {
            const size = parseInt(contentLength, 10);
            console.log(`HEAD request for ${videoDetails.id}: content-length = ${size} bytes`);
            
            // Update file size immediately
            setVideos(prev => 
              prev.map(v => v.id === videoDetails.id ? { 
                ...v, 
                fileSize: size
              } : v)
            );
          }
        }
      } catch (headError) {
        console.warn('HEAD request failed, will get size during download:', headError);
      }
      
      // Create fetch with progress tracking
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
      
      // Get the total size for progress calculation
      const contentLength = response.headers.get('content-length');
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
      
      // Update video with file size
      if (totalSize) {
        console.log(`GET request content-length for ${videoDetails.id}: ${totalSize} bytes`);
        setVideos(prev => 
          prev.map(v => v.id === videoDetails.id ? { 
            ...v, 
            fileSize: totalSize 
          } : v)
        );
      }
      
      // Set up a reader to track download progress
      const reader = response.body.getReader();
      let receivedLength = 0;
      const chunks = [];
      
      while(true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        chunks.push(value);
        receivedLength += value.length;
        
        // Calculate progress percentage
        if (totalSize) {
          const progressPercentage = Math.round((receivedLength / totalSize) * 100);
          
          // Update the video progress
          setVideos(prev => 
            prev.map(v => v.id === videoDetails.id ? { 
              ...v, 
              progress: progressPercentage 
            } : v)
          );
        }
      }
      
      // Concatenate all chunks into a single Uint8Array
      let chunksAll = new Uint8Array(receivedLength);
      let position = 0;
      for (let chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
      }
      
      // Create a blob from the bytes
      const blob = new Blob([chunksAll], { type: 'video/mp4' });
      const videoFile = new File([blob], filename, { type: 'video/mp4' });
      
      // Flag to track if Drive upload was successful
      let driveUploadSuccessful = false;
      
      // Only upload to Drive if saveToDrive is enabled AND we have a selected folder ID
      // This prevents creating a Drive folder when just creating a folder but not selecting it
      if (saveToDrive && session && driveFolderId) {
        try {
          // Include videoId in the uploaded file details for consistent tracking
          const uploadDetails = {
            ...videoDetails,
            videoId: videoId,
            id: videoDetails.id, // Pass the id to track progress
            fileSize: totalSize
          };
          
          const uploadResult = await uploadToDrive(videoFile, uploadDetails);
          if (uploadResult && uploadResult.success) {
            // Set flag that Drive upload was successful
            driveUploadSuccessful = true;
            
            // Return without downloading locally if saving to Drive succeeded
            if (uploadResult.alreadyExists) {
              return;
            }
            
            // Show success message if not already exists
            if (!uploadResult.alreadyExists) {
              toastHelper.success(`Video saved to Google Drive folder: ${folderName}`);
            }
            
            // Return without downloading locally
            return;
          } else {
            console.warn('Drive upload was not successful:', uploadResult?.error || 'Unknown error');
            
            // Check for permission errors
            if (uploadResult.errorCode === 'PERMISSION_DENIED' || 
                (uploadResult.error && uploadResult.error.toLowerCase().includes('permission'))) {
              // Show permission error message
              toastHelper.error('Permission error: Your Google account may not have sufficient permissions to upload to Drive.');
            }
            
            // Since Drive upload failed, show a message and fall back to local download
            toastHelper.warning('Failed to save to Drive, downloading to your device instead');
          }
        } catch (uploadError) {
          console.error('Drive upload failed but continuing with local download:', uploadError);
          toastHelper.warning('Drive upload failed, downloading to your device instead');
        }
      }
      
      // Always download locally if:
      // 1. saveToDrive is false, OR
      // 2. We don't have a session, OR
      // 3. We don't have a selected folder ID, OR
      // 4. User wants a local copy even after successful Drive upload
      // Create a download link for the user's browser
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      
      // No need to show success messages for local download
      /*
      // Show a success message for local download
      if (driveUploadSuccessful) {
        toastHelper.success(`Local copy downloaded: ${filename}`);
      } else {
        toastHelper.success(`Video downloaded to your device: ${filename}`);
      }
      */
    } catch (error) {
      console.error('Error downloading video:', error);
      throw error;
    }
  };

  // Handle file upload
  const handleFileUpload = (file) => {
    if (!file) return;

    // Reset the toast shown flag whenever a new file is uploaded
    setJsonToastShown(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        setJsonData(data);
        
        // Extract video URLs from the JSON data
        const extractedVideos = [];

        // Check for various JSON formats and extract data accordingly
        // Apify format
        if (Array.isArray(data)) {
          const items = data;
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // Try to extract file size from various locations in the JSON structure
            let fileSize = null;
            
            // Check all possible locations where file size might be stored
            if (item.videoData && typeof item.videoData.fileSize === 'number') {
              fileSize = item.videoData.fileSize;
            } else if (item.videoMeta && typeof item.videoMeta.size === 'number') {
              fileSize = item.videoMeta.size;
            } else if (item.video && typeof item.video.size === 'number') {
              fileSize = item.video.size;
            } else if (item.videoDetails && typeof item.videoDetails.fileSize === 'number') {
              fileSize = item.videoDetails.fileSize;
            } else if (item.file && typeof item.file.size === 'number') {
              fileSize = item.file.size;
            }
            
            // Special case for newer TikTok format
            if (item.video && item.video.playAddr && item.video.playAddr.byteCount) {
              fileSize = parseInt(item.video.playAddr.byteCount, 10);
            }
            
            // Log the file size extraction
            if (fileSize) {
              console.log(`Extracted file size for video ${i+1}: ${fileSize} bytes`);
            }
            
            extractedVideos.push({
              id: `video_${i}_${Date.now()}`,
              url: item.webVideoUrl || item.url || (item.videoData ? item.videoData.playAddr : null),
              title: item.text || item.desc || `TikTok Video ${i + 1}`,
              author: item.authorMeta?.name || item.author?.uniqueId || 'Unknown',
              videoId: item.id || '',
              text: item.text || '',
              desc: item.desc || '',
              status: 'pending',
              downloadUrl: null,
              progress: 0,
              fileSize: fileSize
            });
          }
        }
        setVideos(extractedVideos);
        
        // Don't show toast here, will be shown via useEffect after component is mounted
      } catch (error) {
        console.error('Error parsing JSON file:', error);
        // Store the error for useEffect to handle
        setJsonData({ error: error.message });
      }
    };
    reader.readAsText(file);
  };

  // Handle notifications for JSON processing after component is mounted
  useEffect(() => {
    if (!jsonData || jsonToastShown) return;
    
    // Mark toast as shown to prevent multiple notifications
    setJsonToastShown(true);
    
    if (jsonData.error) {
      // Handle JSON parsing error
      toastHelper.error(`Error parsing JSON: ${jsonData.error}`);
      return;
    }
    
    // Success notification
    if (videos.length > 0) {
      toastHelper.success(`Found ${videos.length} videos in the JSON file`);
    } else {
      toastHelper.warning('No videos found in the JSON file');
    }
  }, [jsonData, videos, jsonToastShown]);

  // Clean up title for filename
  const cleanTitle = (title) => {
    if (!title) return 'TikTok Video';
    // Remove hashtags and handle special characters that might be problematic for filenames
    return title.replace(/#\w+/g, '').replace(/[<>:"/\\|?*]/g, '_').trim();
  };

  // Download all videos
  const downloadAllVideos = async () => {
    if (loading || downloadingAll) return;
    
    try {
      setDownloadingAll(true);
      setLoading(true);
      setProgress(0);
      
      // Verify folder existence if saving to Drive
      if (saveToDrive && driveFolderId) {
        const folderExists = await verifyFolderBeforeDownload();
        if (!folderExists) {
          setDownloadingAll(false);
          setLoading(false);
          toastHelper.error('The selected Drive folder no longer exists. Please select another folder.');
          await fetchDriveFolders();
          return;
        }
      }
      
      // Check if videos are already in Drive
      if (saveToDrive && session && driveFolderId) {
        // Create a copy of videos to modify
        let updatedVideos = [...videos];
        let existingCount = 0;
        
        // For each video, check if it exists in Drive
        for (let i = 0; i < updatedVideos.length; i++) {
          const video = updatedVideos[i];
          const videoId = video.videoId || extractVideoIdFromUrl(video.url);
          
          if (videoId) {
            const fileExists = await checkFileExistsInDrive(videoId);
            if (fileExists.exists) {
              // Update video status to completed without downloading
              updatedVideos[i] = {
                ...video,
                status: 'completed',
                progress: 100,
                driveFileId: fileExists.fileId,
                webViewLink: fileExists.webViewLink
              };
              
              existingCount++;
            }
          }
        }
        
        // Update videos with existing files marked as completed
        if (existingCount > 0) {
          setVideos(updatedVideos);
        }
      }
      
      // Filter videos that need downloading (not completed)
      const pendingVideos = videos.filter(v => v.status !== 'completed');
      
      if (pendingVideos.length === 0) {
        setDownloadingAll(false);
        setLoading(false);
        setProgress(100);
        return;
      }
      
      let successCount = 0;
      let failedCount = 0;
      
      for (let i = 0; i < pendingVideos.length; i++) {
        const video = pendingVideos[i];
        
        // Skip videos that are already completed
        if (video.status === 'completed') {
          continue;
        }
        
        setCurrentVideo(video);
        
        try {
          // Update progress based on current video index
          const currentProgress = Math.round((i / pendingVideos.length) * 100);
          setProgress(currentProgress);
          
          // Update video status to processing
          setVideos(prev => 
            prev.map(v => v.id === video.id ? { ...v, status: 'processing', progress: 0 } : v)
          );
          
          // Get download link if we don't have one already
          let downloadUrl = video.downloadUrl;
          if (!downloadUrl) {
            downloadUrl = await getDownloadLink(video.url);
            
            // Update video with download URL
            setVideos(prev => 
              prev.map(v => v.id === video.id ? { ...v, downloadUrl } : v)
            );
          }
          
          if (downloadUrl) {
            // Update video status to downloading
            setVideos(prev => 
              prev.map(v => v.id === video.id ? { ...v, status: 'downloading', progress: 0 } : v)
            );
            
            // Create cleaned filename
            const cleanedTitle = cleanTitle(video.title);
            const filename = `${cleanedTitle}.mp4`;
            
            // Download the video
            await downloadVideo(downloadUrl, filename, {
              ...video,
              title: cleanedTitle,
              description: video.text || video.desc || video.title,
              originalUrl: video.url,
              downloadUrl: downloadUrl,
              videoId: video.videoId || extractVideoIdFromUrl(video.url)
            });
            
            // Update video status to completed
            setVideos(prev => 
              prev.map(v => v.id === video.id ? { 
                ...v, 
                status: 'completed',
                progress: 100 
              } : v)
            );
            
            successCount++;
          } else {
            // No download URL available
            failedCount++;
            setVideos(prev => 
              prev.map(v => v.id === video.id ? { 
                ...v, 
                status: 'failed',
                error: 'Could not get download URL' 
              } : v)
            );
          }
        } catch (error) {
          failedCount++;
          console.error(`Error downloading video ${i+1}:`, error);
          
          // Update video status to failed
          setVideos(prev => 
            prev.map(v => v.id === video.id ? { 
              ...v, 
              status: 'failed',
              error: error.message,
              progress: 0
            } : v)
          );
        }
      }
      
      // Clear current video
      setCurrentVideo(null);
      
      // Set final progress to 100%
      setProgress(100);
      
      // Show summary toast only if there were new operations
      if (successCount > 0 || failedCount > 0) {
        if (successCount > 0 && failedCount === 0) {
          if (saveToDrive && driveFolderId) {
            toastHelper.success(`All ${successCount} videos saved to Google Drive successfully`);
          } else {
            toastHelper.success(`All ${successCount} videos downloaded successfully`);
          }
        } else if (successCount > 0 && failedCount > 0) {
          toastHelper.warning(`${successCount} videos processed successfully, ${failedCount} failed`);
        } else {
          toastHelper.error(`Failed to process all ${failedCount} videos`);
        }
      }
    } catch (error) {
      console.error('Error in batch download:', error);
      toastHelper.error(`Batch download error: ${error.message}`);
    } finally {
      // Reset states
      setLoading(false);
      setDownloadingAll(false);
      setCurrentVideo(null);
    }
  };

  // Download single video
  const downloadSingleVideo = async (video) => {
    // Prevent multiple downloads of the same video
    if (downloadingVideoIds.includes(video.id)) {
      return;
    }
    
    try {
      // Add video ID to the downloading array
      setDownloadingVideoIds(prev => [...prev, video.id]);
      
      // Verify folder existence if saving to Drive
      if (saveToDrive && driveFolderId) {
        const folderExists = await verifyFolderBeforeDownload();
        if (!folderExists) {
          // Folder doesn't exist anymore, refresh the folder list
          await fetchDriveFolders();
          return;
        }
      }
      
      // Extract video ID
      const videoId = video.videoId || extractVideoIdFromUrl(video.url);
      
      // Check if the file already exists in Drive
      if (saveToDrive && session && driveFolderId && videoId) {
        const fileExists = await checkFileExistsInDrive(videoId);
        if (fileExists.exists) {
          console.log(`File already exists in Drive with ID: ${fileExists.fileId}`);
          
          // Update video status to completed without downloading
          setVideos(prev => 
            prev.map(v => v.id === video.id ? { 
              ...v, 
              status: 'completed',
              progress: 100,
              driveFileId: fileExists.fileId,
              webViewLink: fileExists.webViewLink 
            } : v)
          );
          
          // Remove the video ID from the downloading array
          setDownloadingVideoIds(prev => prev.filter(id => id !== video.id));
          
          return;
        }
      }
      
      if (video.status === 'completed' && video.downloadUrl) {
        // If the video is already completed, just download it
        try {
          // Use title without hashtags for the filename
          const cleanedTitle = cleanTitle(video.title);
          const filename = `${cleanedTitle}.mp4`;
          
          // Reset progress to 0 before starting
          setVideos(prev => 
            prev.map(v => v.id === video.id ? { 
              ...v, 
              progress: 0,
              status: 'downloading'
            } : v)
          );
          
          await downloadVideo(video.downloadUrl, filename, {
            ...video,
            title: cleanedTitle,
            description: video.text || video.desc || video.title,
            originalUrl: video.url,
            downloadUrl: video.downloadUrl,
            videoId: video.videoId || extractVideoIdFromUrl(video.url)
          });
          
          // Update video status to completed with 100% progress
          setVideos(prev => 
            prev.map(v => v.id === video.id ? { 
              ...v, 
              status: 'completed',
              progress: 100 
            } : v)
          );
        } catch (e) {
          console.error('Error initiating download:', e);
          // Update video status to failed
          setVideos(prev => 
            prev.map(v => v.id === video.id ? { 
              ...v, 
              status: 'failed',
              error: e.message 
            } : v)
          );
        }
        return;
      }
      
      // Update video status to processing
      setVideos(prev => 
        prev.map(v => v.id === video.id ? { ...v, status: 'processing', progress: 0 } : v)
      );
      
      // Get download link
      const downloadUrl = await getDownloadLink(video.url);
      
      // Update video with download URL
      setVideos(prev => 
        prev.map(v => v.id === video.id ? { ...v, status: 'downloading', downloadUrl, progress: 0 } : v)
      );
      
      // Download video
      if (downloadUrl) {
        try {
          // Use title without hashtags for the filename
          const cleanedTitle = cleanTitle(video.title);
          const filename = `${cleanedTitle}.mp4`;
          await downloadVideo(downloadUrl, filename, {
            ...video,
            title: cleanedTitle,
            description: video.text || video.desc || video.title,
            originalUrl: video.url,
            downloadUrl: downloadUrl,
            videoId: video.videoId || extractVideoIdFromUrl(video.url)
          });
          
          // Update video status to completed with 100% progress
          setVideos(prev => 
            prev.map(v => v.id === video.id ? { 
              ...v, 
              status: 'completed',
              progress: 100 
            } : v)
          );
        } catch (e) {
          console.error('Error downloading video:', e);
          
          // Still mark as completed since the link works
          setVideos(prev => 
            prev.map(v => v.id === video.id ? { 
              ...v, 
              status: 'failed',
              error: e.message,
              progress: 0 
            } : v)
          );
        }
      }
    } catch (error) {
      // Update video status to failed
      setVideos(prev => 
        prev.map(v => v.id === video.id ? { 
          ...v, 
          status: 'failed', 
          error: error.message,
          progress: 0,
          downloadUrl: video.url // In case of failure, set the original URL to open directly
        } : v)
      );
      
      // Store the error to be shown in a safe way instead of calling toastHelper directly
      console.error('Error processing the video:', error);
      setVideos(prev => 
        prev.map(v => v.id === video.id ? { 
          ...v,
          status: 'failed', 
          error: error.message,
          needsErrorToast: true // Flag to show toast in useEffect
        } : v)
      );
    } finally {
      // Always remove the video ID from the downloading array
      setDownloadingVideoIds(prev => prev.filter(id => id !== video.id));
    }
  };

  // Add a useEffect to handle toast notifications for video processing errors
  useEffect(() => {
    // Find any videos that need error toasts
    const videoWithError = videos.find(v => v.needsErrorToast);
    
    if (videoWithError) {
      // Show the error toast
      toastHelper.error(`Error processing the video: ${videoWithError.error}\nPlease try opening the TikTok link directly.`);
      
      // Clear the flag so we don't show the toast again
      setVideos(prev => 
        prev.map(v => v.id === videoWithError.id ? { ...v, needsErrorToast: false } : v)
      );
    }
  }, [videos]);

  // Reset the downloader state
  const resetDownloader = () => {
    setVideos([]);
    setJsonData(null);
    setLoading(false);
    setCurrentVideo(null);
    setProgress(0);
    setJsonToastShown(false);
    setDownloadingAll(false);
    setDownloadingVideoIds([]);
  };

  // Get Drive folder URL
  const getDriveFolderUrl = () => {
    if (!driveFolderId) return null;
    return `https://drive.google.com/drive/folders/${driveFolderId}`;
  };

  // Utility function to extract TikTok video ID from URL
  const extractVideoIdFromUrl = (url) => {
    if (!url) return null;
    
    // Handle different TikTok URL formats
    const tiktokIdRegex = /\/video\/(\d+)|vm\.tiktok\.com\/(\w+)|tiktok\.com\/@[^\/]+\/video\/(\d+)/;
    const matches = url.match(tiktokIdRegex);
    if (matches) {
      return matches[1] || matches[2] || matches[3];
    }
    return null;
  };

  // Return context values
  const value = {
    videos,
    setVideos,
    jsonData,
    setJsonData,
    loading,
    setLoading,
    currentVideo,
    setCurrentVideo,
    progress,
    setProgress,
    driveFolderId,
    setDriveFolderId,
    saveToDrive,
    setSaveToDrive,
    folderName,
    setFolderName,
    driveFolders,
    loadingFolders,
    setLoadingFolders,
    fetchDriveFolders,
    useExistingFolder,
    createDriveFolder,
    getDriveFolderUrl,
    handleFileUpload,
    downloadAllVideos,
    downloadSingleVideo,
    resetDownloader,
    downloadingAll,
    downloadingVideoIds
  };

  return (
    <TikTokContext.Provider value={value}>
      {children}
    </TikTokContext.Provider>
  );
}

// Custom hook for using the TikTok context
export const useTikTok = () => {
  const context = useContext(TikTokContext);
  if (context === undefined) {
    throw new Error('useTikTok must be used within a TikTokProvider');
  }
  return context;
}; 