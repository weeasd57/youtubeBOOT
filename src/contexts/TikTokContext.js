'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

// Create context
const TikTokContext = createContext();

// Provider component
export function TikTokProvider({ children }) {
  const [videos, setVideos] = useState([]);
  const [savedVideos, setSavedVideos] = useState([]);
  const [jsonData, setJsonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [progress, setProgress] = useState(0);
  const [driveFolderId, setDriveFolderId] = useState(null);
  const [saveToDrive, setSaveToDrive] = useState(true);
  const [folderName, setFolderName] = useState('TikTok Downloads');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [driveFolders, setDriveFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const { data: session } = useSession();

  // Fetch saved videos when session changes or when refreshTrigger changes
  useEffect(() => {
    if (!session) return;
    
    async function fetchSavedVideos() {
      try {
        const res = await fetch('/api/tiktok-videos');
        
        if (!res.ok) {
          throw new Error(`Failed to fetch videos: ${res.status}`);
        }
        
        const data = await res.json();
        setSavedVideos(data.videos || []);
      } catch (err) {
        console.error('Error fetching TikTok videos:', err);
      }
    }
    
    fetchSavedVideos();
  }, [session, refreshTrigger]);

  // Fetch drive folders
  const fetchDriveFolders = async () => {
    if (!session) return { success: false, error: "No active session" };
    
    try {
      setLoadingFolders(true);
      
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // Increase timeout to 30 seconds
      
      try {
        const response = await fetch('/api/drive/list-folders', {
          signal: controller.signal,
          // Add cache: 'no-store' to prevent caching issues
          cache: 'no-store'
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`Failed to fetch folders: ${response.status}`, errorData);
          return { success: false, error: errorData.error || `Error ${response.status}` };
        }
        
        const data = await response.json();
        setDriveFolders(data.folders || []);
        
        // Cache folders in localStorage for fallback
        try {
          if (data.folders && data.folders.length > 0) {
            localStorage.setItem('driveFolders', JSON.stringify(data.folders));
          }
        } catch (cacheErr) {
          console.error('Error caching folders:', cacheErr);
        }
        
        return { success: true, folders: data.folders || [] };
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          console.error('Fetching Drive folders timed out');
          
          // Try to get folders from localStorage as fallback
          try {
            const cachedFolders = localStorage.getItem('driveFolders');
            if (cachedFolders) {
              const parsedFolders = JSON.parse(cachedFolders);
              if (Array.isArray(parsedFolders) && parsedFolders.length > 0) {
                console.log('Using cached folders from localStorage');
                setDriveFolders(parsedFolders);
                return { 
                  success: true, 
                  folders: parsedFolders,
                  fromCache: true 
                };
              }
            }
          } catch (cacheErr) {
            console.error('Error reading from cache:', cacheErr);
          }
          
          return { 
            success: false, 
            error: 'Request timed out. Google Drive is taking too long to respond. Please try again later or refresh your authentication.' 
          };
        }
        throw fetchErr;
      }
    } catch (err) {
      console.error('Error fetching Drive folders:', err);
      return { success: false, error: err.message || 'Failed to fetch folders' };
    } finally {
      setLoadingFolders(false);
    }
  };

  // Use existing folder
  const useExistingFolder = (folderId, folderName) => {
    setDriveFolderId(folderId);
    setFolderName(folderName);
  };

  // Create a folder in Google Drive
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
      setDriveFolderId(data.folderId);
      return data.folderId;
    } catch (error) {
      console.error('Error creating Drive folder:', error);
      return null; // Return null instead of throwing
    }
  };

  // Upload file to Google Drive
  const uploadToDrive = async (videoFile, videoDetails) => {
    try {
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
      
      const response = await fetch('/api/drive/upload-file', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        console.error(`Failed to upload file: ${response.status}`);
        return { success: false, error: `Upload failed with status ${response.status}` };
      }

      const data = await response.json();
      return { ...data, success: true };
    } catch (error) {
      console.error('Error uploading to Drive:', error);
      return { success: false, error: error.message || 'Upload failed' };
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
      return data.downloadUrl;
    } catch (error) {
      console.error('Error getting download link:', error);
      throw error;
    }
  };

  // Download video and save to Drive if enabled
  const downloadVideo = async (url, filename, videoDetails) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
      
      const blob = await response.blob();
      const videoFile = new File([blob], filename, { type: 'video/mp4' });
      
      // If save to drive is enabled, upload to Google Drive
      if (saveToDrive && session) {
        try {
          const uploadResult = await uploadToDrive(videoFile, videoDetails);
          if (uploadResult && uploadResult.success) {
            // Refresh the list of saved videos only if upload was successful
            setRefreshTrigger(prev => prev + 1);
          } else {
            console.warn('Drive upload was not successful:', uploadResult?.error || 'Unknown error');
          }
        } catch (uploadError) {
          console.error('Drive upload failed but continuing with local download:', uploadError);
        }
      }
      
      // Create a download link for the user's browser
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading video:', error);
      throw error;
    }
  };

  // Handle file upload
  const handleFileUpload = (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        setJsonData(data);
        
        // Extract video links
        const extractedVideos = [];
        for (const item of data) {
          if (item.webVideoUrl || item.videoUrl) {
            extractedVideos.push({
              id: item.id || `video-${extractedVideos.length + 1}`,
              url: item.webVideoUrl || item.videoUrl,
              title: item.text || item.desc || `Video ${extractedVideos.length + 1}`,
              text: item.text || '',
              desc: item.desc || '',
              status: 'pending',
              downloadUrl: null
            });
          }
        }
        setVideos(extractedVideos);
      } catch (error) {
        console.error('Error parsing JSON file:', error);
        alert('Error parsing the file. Make sure it is a valid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  // Download all videos
  const downloadAllVideos = async () => {
    if (videos.length === 0) return;
    
    setLoading(true);
    setProgress(0);
    
    // If save to drive is enabled, create folder at the beginning
    if (saveToDrive && session && !driveFolderId) {
      try {
        await createDriveFolder();
      } catch (error) {
        console.error('Error preparing drive folder:', error);
      }
    }
    
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      setCurrentVideo(video);
      
      try {
        // Update video status to processing
        setVideos(prev => 
          prev.map(v => v.id === video.id ? { ...v, status: 'processing' } : v)
        );
        
        // Get download link
        const downloadUrl = await getDownloadLink(video.url);
        
        // Update video with download URL
        setVideos(prev => 
          prev.map(v => v.id === video.id ? { ...v, status: 'downloading', downloadUrl } : v)
        );
        
        // Download video
        if (downloadUrl) {
          const filename = `${video.title.replace(/[^\w\s]/gi, '')}.mp4`;
          await downloadVideo(downloadUrl, filename, {
            title: video.title,
            description: video.text || video.desc || video.title,
            originalUrl: video.url,
            downloadUrl: downloadUrl
          });
        }
        
        // Update video status to completed
        setVideos(prev => 
          prev.map(v => v.id === video.id ? { ...v, status: 'completed' } : v)
        );
      } catch (error) {
        // Update video status to failed
        setVideos(prev => 
          prev.map(v => v.id === video.id ? { ...v, status: 'failed', error: error.message } : v)
        );
      }
      
      // Update progress
      setProgress(Math.round(((i + 1) / videos.length) * 100));
      
      // Delay to avoid blocking
      if (i < videos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    setLoading(false);
    setCurrentVideo(null);
  };

  // Download a single video
  const downloadSingleVideo = async (video) => {
    if (video.status === 'completed' && video.downloadUrl) {
      // If the video is already completed, just download it
      try {
        const filename = `${video.title.replace(/[^\w\s]/gi, '')}.mp4`;
        await downloadVideo(video.downloadUrl, filename, {
          title: video.title,
          description: video.text || video.desc || video.title,
          originalUrl: video.url,
          downloadUrl: video.downloadUrl
        });
      } catch (e) {
        console.error('Error initiating download:', e);
        // Open in new tab as an alternative
        window.open(video.downloadUrl, '_blank');
      }
      return;
    }
    
    try {
      // Update video status to processing
      setVideos(prev => 
        prev.map(v => v.id === video.id ? { ...v, status: 'processing' } : v)
      );
      
      // Get download link
      const downloadUrl = await getDownloadLink(video.url);
      
      // Update video with download URL
      setVideos(prev => 
        prev.map(v => v.id === video.id ? { ...v, status: 'downloading', downloadUrl } : v)
      );
      
      // Download video
      if (downloadUrl) {
        try {
          const filename = `${video.title.replace(/[^\w\s]/gi, '')}.mp4`;
          await downloadVideo(downloadUrl, filename, {
            title: video.title,
            description: video.text || video.desc || video.title,
            originalUrl: video.url,
            downloadUrl: downloadUrl
          });
          
          // Update video status to completed
          setVideos(prev => 
            prev.map(v => v.id === video.id ? { ...v, status: 'completed' } : v)
          );
        } catch (e) {
          console.error('Error downloading video:', e);
          // Open in new tab as an alternative
          window.open(downloadUrl, '_blank');
          
          // Still mark as completed since the link works
          setVideos(prev => 
            prev.map(v => v.id === video.id ? { ...v, status: 'completed' } : v)
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
          downloadUrl: video.url // In case of failure, set the original URL to open directly
        } : v)
      );
      
      // Show an error message to the user
      alert(`Error processing the video: ${error.message}\n\nPlease try opening the TikTok link directly.`);
    }
  };

  // Reset the downloader state
  const resetDownloader = () => {
    setVideos([]);
    setJsonData(null);
    setLoading(false);
    setCurrentVideo(null);
    setProgress(0);
  };

  // Function to refresh saved videos
  const refreshSavedVideos = async () => {
    if (!session) return;
    
    try {
      const res = await fetch('/api/tiktok-videos');
      
      if (!res.ok) {
        throw new Error(`Failed to fetch videos: ${res.status}`);
      }
      
      const data = await res.json();
      setSavedVideos(data.videos || []);
    } catch (err) {
      console.error('Error fetching TikTok videos:', err);
    }
  };

  // Get Drive folder URL
  const getDriveFolderUrl = () => {
    if (!driveFolderId) return null;
    return `https://drive.google.com/drive/folders/${driveFolderId}`;
  };

  // Return context values
  const value = {
    videos,
    setVideos,
    savedVideos,
    setSavedVideos,
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
    fetchDriveFolders,
    useExistingFolder,
    getDriveFolderUrl,
    handleFileUpload,
    downloadAllVideos,
    downloadSingleVideo,
    resetDownloader,
    refreshSavedVideos
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