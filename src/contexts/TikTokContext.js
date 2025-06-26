'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { getWithRetry } from '@/utils/apiHelpers';
import { toastHelper } from '@/components/ToastHelper';
import { fetchDriveFoldersWithCache } from '@/utils/driveHelpers';
import { v4 as uuidv4 } from 'uuid';

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
  const [lastDownloadedIndex, setLastDownloadedIndex] = useState(-1);
  const { data: session } = useSession();

  // Add state for concurrency control
  const [concurrentDownloads, setConcurrentDownloads] = useState(3); // Default to 3 concurrent downloads
  const [activeDownloads, setActiveDownloads] = useState(0);
  const abortControllerRef = useRef(null);
  const hasBeenCancelledRef = useRef(false);

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
    
    // Add a timestamp check to avoid excessive API calls
    const lastFolderCheck = localStorage.getItem('lastFolderCheck');
    const currentTime = Date.now();
    
    // Only fetch folders if we haven't checked in the last 30 minutes
    const shouldFetch = !lastFolderCheck || (currentTime - parseInt(lastFolderCheck)) > 30 * 60 * 1000;
    
    if (shouldFetch) {
      // Set timestamp before fetching to avoid race conditions
      localStorage.setItem('lastFolderCheck', currentTime.toString());
      fetchDriveFolders();
    }
    
    // Check every 30 minutes if the folder still exists (was 5 minutes before)
    const intervalId = setInterval(() => {
      if (driveFolderId) {
        localStorage.setItem('lastFolderCheck', Date.now().toString());
        fetchDriveFolders();
      }
    }, 30 * 60 * 1000); // 30 minutes
    
    return () => clearInterval(intervalId);
  }, [session, driveFolderId, fetchDriveFolders]);

  // Check if a folder exists in Google Drive
  const checkFolderExists = async (folderId) => {
    if (!folderId || !session) return false;
    
    try {
      const response = await fetch(`/api/drive/check-folder?folderId=${folderId}`);
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      return data.exists;
    } catch (error) {
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
      return false;
    }
    
    setDriveFolderId(folderId);
    setFolderName(folderName);
    return true;
  };

  // Handle existing folder
  const handleExistingFolder = (folderId, folderName) => {
    // Special case: empty values are used to clear the current folder
    if (folderId === '' && folderName === '') {
      setDriveFolderId(null);
      return true;
    }
    
    // Regular validation for actual folder data
    if (!folderId || !folderName) {
      return false;
    }
    
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
        return null; // Return null instead of throwing
      }

      const data = await response.json();
      // Don't set the folder ID here, let the calling component decide when to use it
      // setDriveFolderId(data.folderId);
      
      // No need to refresh here - we'll handle the refresh in the component
      // that called this function to better control the UI state
      
      return data.folderId;
    } catch (error) {
      return null; // Return null instead of throwing
    }
  };

  // Check if file exists in Google Drive
  const checkFileExistsInDrive = async (videoId) => {
    if (!videoId || !driveFolderId || !session) return false;
    
    try {
      const response = await fetch(`/api/drive/check-file-exists?folderId=${driveFolderId}&videoId=${videoId}`);
      
      if (!response.ok) {
        return { exists: false };
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
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
      }
      
      const response = await fetch('/api/drive/upload-file', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();
          
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
      return { ...data, success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Upload failed due to an unexpected error' 
      };
    }
  };

  // Get download link from the API
  const getDownloadLink = async (tiktokUrl) => {
    try {
      // Return the original URL directly - do not use any download services
      return tiktokUrl;
    } catch (error) {
      throw error;
    }
  };

  // Download video and save to Drive if enabled
  const downloadVideo = async (url, filename, videoDetails) => {
    try {
      // Get the abort signal if available
      const signal = abortControllerRef.current?.signal;
      
      // Check if already aborted
      if (signal && signal.aborted) {
        throw new Error('Download was cancelled');
      }
      
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
      
      // Check if already aborted before making HEAD request
      if (signal?.aborted) {
        throw new Error('Download was cancelled');
      }
      
      // Make a HEAD request first to get content length without downloading
      try {
        const headResponse = await fetch(url, { 
          method: 'HEAD',
          signal, // Pass the abort signal to the fetch request
          timeout: 10000 // Add 10 second timeout
        });
        if (headResponse.ok) {
          const contentLength = headResponse.headers.get('content-length');
          if (contentLength) {
            const size = parseInt(contentLength, 10);
            
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
        // If aborted, propagate the error
        if (headError.name === 'AbortError') {
          throw new Error('Download was cancelled');
        }
        // Otherwise continue with the download
      }
      
      // Check if already aborted before making main request
      if (signal && signal.aborted) {
        throw new Error('Download was cancelled');
      }
      
      // Create fetch with progress tracking
      const response = await fetch(url, { signal }); // Pass the abort signal to the fetch request
      if (!response.ok) {
        // تحسين رسالة الخطأ للمستخدم
        if (response.status === 404) {
          throw new Error(`Download link unavailable (404): The direct link in the JSON file is invalid or has expired`);
        } else {
          throw new Error(`Download failed: ${response.status} - Please check the validity of the links in the JSON file`);
        }
      }
      
      // Get the total size for progress calculation
      const contentLength = response.headers.get('content-length');
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
      
      // Update video with file size
      if (totalSize) {
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
      
      // Setup more frequent UI updates
      let lastProgressUpdate = 0;
      let lastAbortCheck = 0;
      
      try {
        while(true) {
          // Check for abort signal periodically to reduce overhead
          const now = Date.now();
          if (now - lastAbortCheck > 100) { // Check every 100ms
            lastAbortCheck = now;
            if (signal?.aborted) {
              try {
                await reader.cancel(); // Cancel the reader properly
              } catch (cancelError) {
                console.error('Error cancelling reader:', cancelError);
              }
              throw new Error('Download was cancelled');
            }
          }
          
          let readResult;
          try {
            readResult = await reader.read();
          } catch (readError) {
            // Check if this is an abort error
            if (readError.name === 'AbortError' || signal?.aborted) {
              throw new Error('Download was cancelled');
            }
            console.error('Error reading chunk:', readError);
            throw readError;
          }
          
          const { done, value } = readResult;
          
          if (done) {
            break;
          }
          
          chunks.push(value);
          receivedLength += value.length;
          
          // Calculate progress percentage
          if (totalSize) {
            const progressPercentage = Math.round((receivedLength / totalSize) * 100);
            
            // Update progress more frequently (but not on every chunk to avoid too many renders)
            const now = Date.now();
            if (progressPercentage !== lastProgressUpdate && (now - lastProgressUpdate > 200 || progressPercentage % 5 === 0)) {
              lastProgressUpdate = now;
              
              // Update the video progress
              setVideos(prev => 
                prev.map(v => v.id === videoDetails.id ? { 
                  ...v, 
                  progress: progressPercentage,
                  status: 'downloading' // Ensure status is downloading
                } : v)
              );
              
              // Update current video progress if this is the current video
              setCurrentVideo(prev => {
                if (prev && prev.id === videoDetails.id) {
                  return { ...prev, progress: progressPercentage, status: 'downloading' };
                }
                return prev;
              });
              
              // Force a small delay to allow React to render updates
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }
        }
      } catch (streamError) {
        // If this is an abort error, propagate it
        if (streamError.message === 'Download was cancelled' || streamError.name === 'AbortError' || signal?.aborted) {
          throw new Error('Download was cancelled');
        }
        // For other errors, throw with details
        console.error('Error in download stream:', streamError);
        throw streamError;
      }
      
      // Check if aborted before continuing
      if (signal && signal.aborted) {
        throw new Error('Download was cancelled');
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
            
            // Update video with Drive file ID and web link
            setVideos(prev => 
              prev.map(v => v.id === videoDetails.id ? { 
                ...v, 
                status: 'completed',
                progress: 100,
                driveFileId: uploadResult.fileId,
                webViewLink: uploadResult.webViewLink
              } : v)
            );
            
            // Also update current video if it matches
            setCurrentVideo(prev => {
              if (prev && prev.id === videoDetails.id) {
                return { 
                  ...prev, 
                  status: 'completed', 
                  progress: 100,
                  driveFileId: uploadResult.fileId,
                  webViewLink: uploadResult.webViewLink
                };
              }
              return prev;
            });
            
            // Save to Supabase if we have a video ID
            if (videoId && session) {
              try {
                await fetch('/api/tiktok/videos', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    videoId,
                    title: videoDetails.title,
                    description: videoDetails.description,
                    originalUrl: videoDetails.originalUrl,
                    downloadUrl: videoDetails.downloadUrl,
                    driveFolderId,
                    driveFileId: uploadResult.fileId
                  }),
                });
              } catch (supabaseError) {
                console.error('Error saving to Supabase:', supabaseError);
                // Non-critical error, continue
              }
            }
            
            return;
          } else {
            // Drive upload failed but a Drive folder is selected
            // Update video status to failed
            setVideos(prev => 
              prev.map(v => v.id === videoDetails.id ? { 
                ...v, 
                status: 'failed',
                error: uploadResult?.error || 'Failed to upload to Google Drive'
              } : v)
            );
            
            // Also update current video if it matches
            setCurrentVideo(prev => {
              if (prev && prev.id === videoDetails.id) {
                return { 
                  ...prev, 
                  status: 'failed',
                  error: uploadResult?.error || 'Failed to upload to Google Drive'
                };
              }
              return prev;
            });
            
            // Show error notification
            toastHelper.error(`Failed to upload to Google Drive: ${uploadResult?.error || 'Unknown error'}`);
            
            // Return without downloading locally since Drive folder is selected
            return;
          }
        } catch (driveError) {
          console.error('Drive upload error:', driveError);
          
          // Drive upload failed with an exception but a Drive folder is selected
          // Update video status to failed
          setVideos(prev => 
            prev.map(v => v.id === videoDetails.id ? { 
              ...v, 
              status: 'failed',
              error: driveError.message || 'Error uploading to Google Drive'
            } : v)
          );
          
          // Show error notification
          toastHelper.error(`Error uploading to Google Drive: ${driveError.message || 'Unknown error'}`);
          
          // Return without downloading locally since Drive folder is selected
          return;
        }
      }
      
      // Only proceed with local download if Drive is not enabled or no folder is selected
      if (!saveToDrive || !driveFolderId) {
        // Create a download link
        const downloadUrl = URL.createObjectURL(blob);
        
        // Create a link element and trigger download
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          URL.revokeObjectURL(downloadUrl);
          document.body.removeChild(a);
        }, 100);
        
        // Update video status to completed
        setVideos(prev => 
          prev.map(v => v.id === videoDetails.id ? { 
            ...v, 
            status: 'completed',
            progress: 100
          } : v)
        );
        
        // Also update current video if it matches
        setCurrentVideo(prev => {
          if (prev && prev.id === videoDetails.id) {
            return { ...prev, status: 'completed', progress: 100 };
          }
          return prev;
        });
      }
    } catch (error) {
      // Handle abort errors specially
      if (error.message === 'Download was cancelled' || error.name === 'AbortError') {
        console.log(`Download of ${filename} was cancelled`);
        throw error; // Re-throw to be handled by the caller
      }
      
      // For other errors, update the video status and throw
      setVideos(prev => 
        prev.map(v => v.id === videoDetails.id ? { 
          ...v, 
          status: 'failed',
          error: error.message
        } : v)
      );
      
      throw error;
    }
  };

  // Handle file upload
  const handleFileUpload = (file) => {
    // Update to null/empty in case of previous uploads
    setJsonData(null);
    setVideos([]);
    setLoading(false);
    setProgress(0);
    setCurrentVideo(null);
    setJsonToastShown(false);
    setDownloadingAll(false);
    setDownloadingVideoIds([]);
    
    // Read the file as text
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const data = JSON.parse(content);
        
        // Store the raw JSON data for reference
        setJsonData(data);
        
        // Extract videos from the various formats we've seen
        let extractedVideos = [];
        
        // If it's an array directly
        if (Array.isArray(data)) {
          extractedVideos = data;
        } 
        // If it's from Apify TikTok Scraper format
        else if (data.items && Array.isArray(data.items)) {
          extractedVideos = data.items;
        }
        // Check for nested exports format (e.g. from Favorites)
        else if (data.exports && Array.isArray(data.exports)) {
          extractedVideos = data.exports;
        }
        // Check for nested data or result array common in some export formats
        else if (data.data && Array.isArray(data.data)) {
          extractedVideos = data.data;
        }
        else if (data.result && Array.isArray(data.result)) {
          extractedVideos = data.result;
        }
        
        // If no items found, check for nested structure
        if (extractedVideos.length === 0 && data.data && data.data.videos) {
          extractedVideos = data.data.videos;
        }
        
        // Map to a common format
        const processedVideos = extractedVideos.map((item, index) => {
          // Extract video URL - handle different formats
          let videoUrl = '';
          let videoId = '';
          let title = '';
          let duration = null;
          let definition = null;
          let videoData = null;
          
          // Try to extract file size if available in the JSON
          let fileSize = null;
          
          // Extract video metadata if available
          if (item.video) {
            videoData = item.video;
            // Check for duration in various locations
            if (item.video.duration) {
              duration = Number(item.video.duration);
            }
            // Check for definition/quality in various locations
            if (item.video.definition) {
              definition = item.video.definition;
            }
            // Check for file size
            if (item.video.size) {
              fileSize = Number(item.video.size);
            }
          }
          
          // Check for duration directly in the item
          if (!duration && item.duration) {
            duration = Number(item.duration);
          }

          // Check for other possible duration fields
          if (!duration) {
            if (item.videoDuration) {
              duration = Number(item.videoDuration);
            } else if (item.video_duration) {
              duration = Number(item.video_duration);
            } else if (item.length) {
              duration = Number(item.length);
            } else if (item.stats && item.stats.duration) {
              duration = Number(item.stats.duration);
            } else if (item.stats && item.stats.video_duration) {
              duration = Number(item.stats.video_duration);
            } else if (item.meta && item.meta.duration) {
              duration = Number(item.meta.duration);
            } else if (item.meta && item.meta.video_duration) {
              duration = Number(item.meta.video_duration);
            } else if (item.videoMeta && item.videoMeta.duration) {
              duration = Number(item.videoMeta.duration);
            }
          }
          
          // Try to extract definition/quality
          if (!definition) {
            if (item.definition) {
              definition = item.definition;
            } else if (item.videoQuality) {
              definition = item.videoQuality;
            } else if (item.video && item.video.height) {
              // If we have height, we can make an educated guess about quality
              const height = item.video.height;
              if (height >= 1080) definition = "1080p";
              else if (height >= 720) definition = "720p";
              else if (height >= 480) definition = "480p";
              else definition = "Standard";
            }
          }
          
          // Extract URL based on different JSON formats
          if (item.video && item.video.downloadAddr) {
            videoUrl = item.video.downloadAddr;
          } else if (item.downloadAddr) {
            videoUrl = item.downloadAddr;
          } else if (item.mediaUrls && item.mediaUrls.length > 0) {
            videoUrl = item.mediaUrls[0];
          } else if (item.video && item.video.mediaUrls && item.video.mediaUrls.length > 0) {
            videoUrl = item.video.mediaUrls[0];
          }
          
          // If we still don't have a URL, check for video.urls array
          if (!videoUrl && item.video && item.video.urls && item.video.urls.length > 0) {
            videoUrl = item.video.urls[0];
          }
          
          // Extract title
          if (item.desc) {
            title = item.desc;
          } else if (item.description) {
            title = item.description;
          } else if (item.title) {
            title = item.title;
          } else if (item.text) {
            title = item.text;
          } else {
            title = `TikTok Video ${index + 1}`;
          }
          
          // Generate a unique ID
          const id = uuidv4();
          
          return {
            id,
            title: cleanTitle(title),
            url: videoUrl,
            status: 'pending',
            progress: 0,
            fileSize,
            duration,
            definition,
            videoData,
            originalUrl: videoUrl // Keep a copy of the original URL
          };
        }).filter(item => item.url);
        
        // Set the videos state
        setVideos(processedVideos);
        
        // Show a toast notification
        if (processedVideos.length > 0) {
          toastHelper.success(`Found ${processedVideos.length} TikTok videos`);
        } else {
          toastHelper.error('No valid TikTok videos found in the JSON file');
        }
      } catch (error) {
        toastHelper.error('Failed to parse JSON file: ' + error.message);
      }
    };
    
    reader.onerror = (error) => {
      toastHelper.error('Failed to read file');
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

  // وظيفة للتحقق من صحة الرابط قبل التحميل
  const validateUrl = async (url) => {
    console.log('[DEBUG] validateUrl: checking', url);
    try {
      // التحقق من تنسيق URL
      if (!url || typeof url !== 'string') {
        return { valid: false, error: 'Download link is invalid or missing' };
      }

      // التحقق من أن الرابط ليس فارغًا
      if (url.trim() === '') {
        return { valid: false, error: 'Download link is empty' };
      }

      // التحقق من أن الرابط يبدأ بـ http:// أو https://
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return { valid: false, error: 'Download link must start with http:// or https://' };
      }

      // محاولة التحقق من صحة الرابط باستخدام HEAD request
      const headResponse = await fetch(url, { method: 'HEAD', timeout: 10000 });
      console.log('[DEBUG] validateUrl: HEAD status', headResponse.status);
      
      if (!headResponse.ok) {
        if (headResponse.status === 404) {
          return { valid: false, error: `Download link unavailable (404): The direct link in the JSON file is invalid or has expired` };
        } else {
          return { valid: false, error: `Download link unavailable (${headResponse.status})` };
        }
      }
      
      // التحقق من نوع المحتوى إذا كان متاحًا
      const contentType = headResponse.headers.get('content-type');
      if (contentType && !contentType.includes('video') && !contentType.includes('octet-stream') && !contentType.includes('binary')) {
        return { valid: false, error: `Download link does not contain a video file (${contentType})` };
      }
      
      return { valid: true };
    } catch (error) {
      console.error('[DEBUG] validateUrl: HEAD error', error);
      // قد يرفض بعض الخوادم طلبات HEAD أو تعطي timeout
      // في هذه الحالة سنعيد صحة الرابط = true ونحاول التحميل المباشر
      return { valid: true, warning: 'Could not verify the link, will try direct download' };
    }
  };

  // Helper function to process video download in parallel
  const processVideoDownload = async (video) => {
    try {
      // Check abort signal
      if (abortControllerRef.current?.signal?.aborted) {
        console.log("Aborting video download due to cancel signal");
        return { success: false, video, error: 'Download cancelled' };
      }
      
      // Update video status to processing
      setVideos(prev => 
        prev.map(v => v.id === video.id ? { ...v, status: 'processing', progress: 0 } : v)
      );
      
      // Get download link if we don't have one already
      let downloadUrl = video.downloadUrl;
      if (!downloadUrl) {
        // Check if cancelled before getting download link
        if (abortControllerRef.current?.signal?.aborted) {
          return { success: false, video, error: 'Download cancelled' };
        }
        
        downloadUrl = await getDownloadLink(video.url);
        
        // Update video with download URL
        setVideos(prev => 
          prev.map(v => v.id === video.id ? { ...v, downloadUrl } : v)
        );
      }
      
      if (downloadUrl) {
        // Verify the link before downloading
        const urlValidation = await validateUrl(downloadUrl);
        if (!urlValidation.valid) {
          // Update video status to failed with error message
          setVideos(prev => 
            prev.map(v => v.id === video.id ? { 
              ...v, 
              status: 'failed', 
              error: urlValidation.error || 'Invalid download link' 
            } : v)
          );
          return { success: false, video, error: urlValidation.error || 'Invalid download link' };
        }
        
        // Update video status to downloading
        setVideos(prev => 
          prev.map(v => v.id === video.id ? { ...v, status: 'downloading', progress: 0 } : v)
        );
        
        // Also update the current video if it matches
        setCurrentVideo(prev => {
          if (prev && prev.id === video.id) {
            return { ...prev, status: 'downloading', progress: 0 };
          }
          return prev;
        });
        
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
        
        // Check if cancelled after download
        if (abortControllerRef.current?.signal?.aborted) {
          return { success: false, video, error: 'Download cancelled' };
        }
        
        // Update video status to completed
        setVideos(prev => 
          prev.map(v => v.id === video.id ? { 
            ...v, 
            status: 'completed',
            progress: 100 
          } : v)
        );
        
        // Also update the current video if it matches
        setCurrentVideo(prev => {
          if (prev && prev.id === video.id) {
            return { ...prev, status: 'completed', progress: 100 };
          }
          return prev;
        });
        
        return { success: true, video };
      } else {
        // No download URL available
        setVideos(prev => 
          prev.map(v => v.id === video.id ? { 
            ...v, 
            status: 'failed',
            error: 'Could not find download link. Make sure your JSON file contains valid direct links.' 
          } : v)
        );
        return { success: false, video, error: 'Could not find download link' };
      }
    } catch (error) {
      console.error('Error in processVideoDownload:', error);
      
      // Check if this was a cancellation error
      const wasCancelled = error.message === 'Download was cancelled' || 
                          error.name === 'AbortError' ||
                          abortControllerRef.current?.signal?.aborted;
      
      if (wasCancelled) {
        console.log(`Download of video ${video.title || video.id} was cancelled`);
        
        // Reset the video status to pending
        setVideos(prev => 
          prev.map(v => v.id === video.id ? { 
            ...v, 
            status: 'pending',
            progress: 0,
            error: 'Download was cancelled'
          } : v)
        );
        
        return { success: false, video, cancelled: true, error: 'Download was cancelled' };
      }
      
      // For other errors, mark as failed
      setVideos(prev => 
        prev.map(v => v.id === video.id ? { 
          ...v, 
          status: 'failed',
          error: error.message,
          progress: 0
        } : v)
      );
      return { success: false, video, error: error.message };
    }
  };

  // Modified downloadAllVideos function to implement parallel processing
  const downloadAllVideos = async () => {
    if (loading || downloadingAll) return;
    console.log('[DEBUG] downloadAllVideos: started');
    try {
      // Create new abort controller for this batch after aborting any existing one
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort(); // Abort any existing downloads first
          console.log('[DEBUG] downloadAllVideos: Aborted previous downloads');
        } catch (error) {
          console.error('[DEBUG] Error aborting existing downloads:', error);
        }
      }
      abortControllerRef.current = new AbortController();
      hasBeenCancelledRef.current = false;
      setDownloadingAll(true);
      setLoading(true);
      setProgress(0);
      console.log('[DEBUG] downloadAllVideos: State set, checking folder...');
      // Verify folder existence and check save preferences
      if (saveToDrive && driveFolderId) {
        const folderExists = await verifyFolderBeforeDownload();
        if (!folderExists) {
          setDownloadingAll(false);
          setLoading(false);
          console.log('[DEBUG] downloadAllVideos: Folder does not exist, aborting.');
          toastHelper.error('The selected Drive folder no longer exists. Please select another folder.');
          await fetchDriveFolders();
          return;
        }
        console.log('[DEBUG] downloadAllVideos: Folder exists, proceeding.');
        // Notify user that videos will only be saved to Google Drive
        toastHelper.info('Videos will be saved to Google Drive only and not downloaded locally.');
      } else if (!saveToDrive) {
        // Notify user that videos will be downloaded locally
        console.log('[DEBUG] downloadAllVideos: Will download locally.');
        toastHelper.info('Videos will be downloaded to your device.');
      } else {
        // No Drive folder selected but Drive save is enabled
        console.log('[DEBUG] downloadAllVideos: No Drive folder selected, aborting.');
        toastHelper.warning('Please select a Google Drive folder or disable "Save to Drive" option.');
        setDownloadingAll(false);
        setLoading(false);
        return;
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
          
          // Update progress for preflight checks
          const preflightProgress = Math.round((i / updatedVideos.length) * 20); // Use first 20% for preflight
          setProgress(preflightProgress);
        }
        
        // Update videos with existing files marked as completed
        if (existingCount > 0) {
          setVideos(updatedVideos);
          toastHelper.info(`${existingCount} videos already exist in Drive and will be skipped.`);
        }
      }
      
      // Filter videos that need downloading (not completed)
      const pendingVideos = videos.filter(v => v.status !== 'completed');
      
      if (pendingVideos.length === 0) {
        setDownloadingAll(false);
        setLoading(false);
        setProgress(100);
        toastHelper.info('All videos are already downloaded.');
        return;
      }
      
      // Process concurrency for downloads
      const maxConcurrent = concurrentDownloads;
      
      // Make sure we have a fresh AbortController
      if (!abortControllerRef.current) {
        abortControllerRef.current = new AbortController();
      }
      
      // Start from the last downloaded index + 1 if it's valid, otherwise start from 0
      let currentIndex = 0;
      
      // Check if we should resume from a previous position
      if (lastDownloadedIndex >= 0 && lastDownloadedIndex < pendingVideos.length - 1) {
        currentIndex = lastDownloadedIndex + 1;
        toastHelper.info(`Resuming downloads from video ${currentIndex + 1} of ${pendingVideos.length}`);
      }
      
      let completedCount = 0;
      let successCount = 0;
      let failedCount = 0;
      let hasBeenCancelled = false;
      
      // Get the abort signal
      const signal = abortControllerRef.current.signal;
      
      // Function to start a new download
      const startNextDownload = async () => {
        if (currentIndex >= pendingVideos.length || signal.aborted || hasBeenCancelledRef.current) {
          return;
        }
        
        // Check if the download has been aborted before starting a new one
        if (signal.aborted) {
          console.log("Download aborted during processing");
          return;
        }
        
        const video = pendingVideos[currentIndex];
        const videoIndex = currentIndex; // Store the current index for later
        currentIndex++;
        setActiveDownloads(prev => prev + 1);
        
        // Set current video for display
        setCurrentVideo(video);
        
        try {
          // Check if the process has been cancelled
          if (signal.aborted || hasBeenCancelledRef.current) {
            console.log("Download aborted during processing");
            return;
          }
          
          const result = await processVideoDownload(video);
          
          // Check again if cancelled after download
          if (signal.aborted || hasBeenCancelledRef.current) {
            console.log("Download process was cancelled after video completion");
            return;
          }
          
          // Update completed count
          completedCount++;
          
          // Update progress (80% of progress bar is for downloads, 20% was for preflight)
          const downloadProgress = 20 + Math.round((completedCount / pendingVideos.length) * 80);
          setProgress(downloadProgress);
          
          if (result.success) {
            successCount++;
            // Update last downloaded index if this download was successful
            setLastDownloadedIndex(videoIndex);
          } else if (!result.cancelled) {
            failedCount++;
          }
        } catch (error) {
          console.error(`Error processing video ${video.id}:`, error);
          failedCount++;
        } finally {
          setActiveDownloads(prev => Math.max(0, prev - 1));
          
          // Start another download if not aborted and not cancelled
          if (!signal.aborted && !hasBeenCancelledRef.current) {
            startNextDownload();
          }
        }
      };
      
      // Start initial batch of downloads based on concurrency
      const initialBatchSize = Math.min(maxConcurrent, pendingVideos.length);
      for (let i = 0; i < initialBatchSize && !hasBeenCancelledRef.current; i++) {
        startNextDownload();
      }
      
      // Wait for all downloads to complete or until cancelled
      let checkCount = 0;
      while (completedCount < pendingVideos.length && activeDownloads > 0 && !signal.aborted && !hasBeenCancelledRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Reduced wait time for faster cancellation
        
        checkCount++;
        
        // Log status periodically to help with debugging
        if (checkCount % 10 === 0) {
          console.log(`Download status: ${completedCount}/${pendingVideos.length} completed, abort status: ${signal.aborted}`);
        }
        
        // Break out early if abort was detected
        if (signal.aborted) {
          console.log("Abort detected in main wait loop");
          break;
        }
      }
      
      // Check if aborted before finishing up
      if (signal.aborted) {
        console.log("Download process was aborted before completion");
        // No need to show toast or update states here as the cancelDownloads function handles this
        return;
      }
      
      // If all videos completed successfully, reset the last downloaded index
      if (completedCount === pendingVideos.length && failedCount === 0) {
        setLastDownloadedIndex(-1);
      }
      
      // Clear current video
      setCurrentVideo(null);
      
      // Set final progress to 100%
      setProgress(100);
      
      // Show summary toast
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
      toastHelper.error(`Batch download error: ${error.message}`);
    } finally {
      setLoading(false);
      setDownloadingAll(false);
      setCurrentVideo(null);
      setActiveDownloads(0);
    }
  };

  // Add function to cancel ongoing downloads with cleanup
  const cancelDownloads = () => {
    console.log('[DEBUG] cancelDownloads: called');
    try {
      // First, set the cancellation flag
      hasBeenCancelledRef.current = true;
      
      // Then abort any ongoing downloads
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
          console.log('[DEBUG] cancelDownloads: Aborted current downloads');
        } catch (abortError) {
          console.error('[DEBUG] Error during abort:', abortError);
        }
        // Immediately nullify the current controller
        abortControllerRef.current = null;
      }

      // Reset all state variables immediately
      setLoading(false);
      setDownloadingAll(false);
      setProgress(0);
      setCurrentVideo(null);
      setActiveDownloads(0);
      setDownloadingVideoIds([]);

      // Reset individual video states that are still processing or downloading
      setVideos(prev =>
        prev.map(v => {
          if (v.status === 'processing' || v.status === 'downloading') {
            return {
              ...v,
              status: 'pending',
              progress: 0,
              error: 'Download cancelled'
            };
          }
          return v;
        })
      );

      // Create a new controller for future downloads
      abortControllerRef.current = new AbortController();
      
      // Show success message
      toastHelper.success('Downloads cancelled successfully');
      console.log('[DEBUG] cancelDownloads: finished');
    } catch (error) {
      console.error('[DEBUG] Error in cancelDownloads:', error);
      // Force reset everything in case of error
      hasBeenCancelledRef.current = true;
      setLoading(false);
      setDownloadingAll(false);
      setActiveDownloads(0);
      setCurrentVideo(null);
      setDownloadingVideoIds([]);
      setProgress(0);
      
      // Always ensure we have a fresh controller
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch (e) {
          // Ignore abort errors
        }
      }
      abortControllerRef.current = new AbortController();
      
      toastHelper.error('Error while canceling downloads. Application state has been reset.');
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
      
      // Verify folder existence and check save preferences
      if (saveToDrive && driveFolderId) {
        const folderExists = await verifyFolderBeforeDownload();
        if (!folderExists) {
          // Folder doesn't exist anymore, refresh the folder list
          await fetchDriveFolders();
          // Remove the video ID from the downloading array
          setDownloadingVideoIds(prev => prev.filter(id => id !== video.id));
          return;
        }
        
        // Notify user that video will only be saved to Google Drive
        toastHelper.info('Video will be saved to Google Drive only and not downloaded locally.');
      } else if (!saveToDrive) {
        // Notify user that video will be downloaded locally
        toastHelper.info('Video will be downloaded to your device.');
      } else {
        // No Drive folder selected but Drive save is enabled
        toastHelper.warning('Please select a Google Drive folder or disable "Save to Drive" option.');
        // Remove the video ID from the downloading array
        setDownloadingVideoIds(prev => prev.filter(id => id !== video.id));
        return;
      }
      
      // Extract video ID
      const videoId = video.videoId || extractVideoIdFromUrl(video.url);
      
      // Check if the file already exists in Drive
      if (saveToDrive && session && driveFolderId && videoId) {
        const fileExists = await checkFileExistsInDrive(videoId);
        if (fileExists.exists) {
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
      
      // If video already has a status and downloadUrl, use that
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
      
      // Check if the URL is available directly from the video object
      if (!video.url) {
        setVideos(prev => 
          prev.map(v => v.id === video.id ? { 
            ...v, 
            status: 'failed',
            error: 'No direct download URL found in JSON data (downloadAddr or mediaUrls required)'
          } : v)
        );
        // Remove the video ID from the downloading array
        setDownloadingVideoIds(prev => prev.filter(id => id !== video.id));
        return;
      }
      
      // Update video status to downloading
      setVideos(prev => 
        prev.map(v => v.id === video.id ? { ...v, status: 'downloading', downloadUrl: video.url, progress: 0 } : v)
      );
      
      // Download video directly from the URL in JSON
      try {
        // Verify the link before downloading
        const urlValidation = await validateUrl(video.url);
        if (!urlValidation.valid) {
          // Update video status to failed with error message
          setVideos(prev => 
            prev.map(v => v.id === video.id ? { 
              ...v, 
              status: 'failed', 
              error: urlValidation.error || 'Invalid download link' 
            } : v)
          );
          return;
        }
        
        // Use title without hashtags for the filename
        const cleanedTitle = cleanTitle(video.title);
        const filename = `${cleanedTitle}.mp4`;
        await downloadVideo(video.url, filename, {
          ...video,
          title: cleanedTitle,
          description: video.text || video.desc || video.title,
          originalUrl: video.url,
          downloadUrl: video.url,
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
        // Update video status to failed
        setVideos(prev => 
          prev.map(v => v.id === video.id ? { 
            ...v, 
            status: 'failed',
            error: e.message,
            progress: 0 
          } : v)
        );
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
    setProgress(0);
    setCurrentVideo(null);
    setDownloadingAll(false);
    setLoading(false);
    setDownloadingVideoIds([]);
    setLastDownloadedIndex(-1); // Reset the last downloaded index
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
    downloadingVideoIds,
    cancelDownloads,
    concurrentDownloads,
    setConcurrencyLevel,
    lastDownloadedIndex,
    setConcurrentDownloads
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

const setConcurrencyLevel = (level) => setConcurrentDownloads(level);