'use client';

import { useState, useEffect } from 'react';
import { FaFileVideo, FaFolder } from 'react-icons/fa';
import DriveThumbnail from './DriveThumbnail';
import { supabase } from '@/utils/supabase-client';

export default function FileListItem({ 
  file, 
  onSchedule, 
  className = ''
}) {
  const [hovered, setHovered] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
  
  // Function to extract video_id from file.name
  const extractVideoId = (fileName) => {
    if (!fileName) return null;
    const match = fileName.match(/(?:Tiktok\s?)?(\d{19})/);
    return match ? match[1] : null;
  };

  useEffect(() => {
    const videoId = extractVideoId(file.name);

    if (isFolder || !videoId) { // Check for videoId instead of file.id
      setLoading(false);
      if (!isFolder && !videoId) {
        // Only log/error if it's a file but we couldn't extract videoId
        console.warn(`Could not extract video_id from file name: ${file.name}`);
        // Optionally set an error state here to inform the user
        // setError(`Invalid file name format: ${file.name}`);
        setVideoData(null); // Ensure no stale data is shown
      }
      return;
    }
    const fetchVideoDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: supabaseError } = await supabase
          .from('tiktok_videos')
          .select('title, description, hashtags')
          .eq('video_id', videoId) // Use extracted video_id here
          .maybeSingle(); // استخدام maybeSingle بدلاً من single للتعامل مع السجلات المتعددة

        if (supabaseError) {
          // لن يحدث خطأ PGRST116 مع maybeSingle، لذا سنتعامل فقط مع الأخطاء الأخرى
          console.error(`Error fetching data for video_id: ${videoId}`, supabaseError);
          throw supabaseError;
        }
        
        // إذا لم يتم العثور على أي بيانات، data ستكون null
        if (!data) {
          console.warn(`No Supabase entry found for video_id: ${videoId} (from file: ${file.name})`);
        }
        
        setVideoData(data);
      } catch (err) {
        console.error('Error fetching video details from Supabase:', err);
        setError(err.message || 'Failed to fetch video details');
        setVideoData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchVideoDetails();
  }, [file.name, isFolder]); // Depend on file.name now, as videoId is derived from it
  
  const displayTitle = videoData?.title || (loading ? 'Loading title...' : file.name);
  
  const descriptionFromSupabase = videoData?.description;
  const hasDescription = descriptionFromSupabase && descriptionFromSupabase.trim().length > 0;
  
  let hashtagsArray = [];
  if (videoData?.hashtags) {
    if (Array.isArray(videoData.hashtags)) {
      hashtagsArray = videoData.hashtags;
    } else if (typeof videoData.hashtags === 'string') {
      hashtagsArray = videoData.hashtags.split(' ').filter(h => h.startsWith('#'));
    }
  }
  const hasHashtags = hashtagsArray.length > 0;

  if (isFolder) {
    return null;
  }

  if (loading && !videoData) {
    return (
      <div className={`relative flex flex-col w-full p-4 items-center justify-center ${className}`}>
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading video details...</div>
      </div>
    );
  }
  
  if (error && !videoData) {
    return (
      <div className={`relative flex flex-col w-full p-4 items-center justify-center bg-red-50 dark:bg-red-900/30 ${className}`}>
        <div className="text-sm text-red-700 dark:text-red-300">Error: {error}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={file.name}>
          File: {file.name}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative flex flex-col w-full transition-all ${
        hovered ? 'bg-gray-50 dark:bg-gray-900/30' : ''
      } ${className}`}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
    >
      <div className="w-full flex justify-center mb-2 relative">
        <DriveThumbnail 
          src={file.thumbnailLink} 
          alt={displayTitle}
          width={120} 
          height={120} 
          className="rounded-md"
          fallbackText={displayTitle?.substring(0, 1)?.toUpperCase() || 'V'}
        />
      </div>
      
      <div className="w-full">
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={displayTitle}>
          {loading && !videoData?.title ? 'Loading title...' : (videoData?.title || file.name)}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {loading && !videoData?.description && !videoData?.title ? (
            <span>&nbsp;</span>
          ) : hasDescription ? (
            <span className="inline-flex items-center">
              <span className="truncate max-w-full inline-block" title={descriptionFromSupabase}>
                {descriptionFromSupabase.substring(0, 50)}
                {descriptionFromSupabase.length > 50 ? '...' : ''}
              </span>
            </span>
          ) : videoData && !hasDescription && !loading ? (
            <span>No description available.</span>
          ) : !loading && !extractVideoId(file.name) ? (
             <span className="truncate" title={file.name}>
               {file.name.length > 50 ? `${file.name.substring(0, 47)}...` : file.name}
             </span>
           ) : !loading && !videoData ? ( 
             <span>{extractVideoId(file.name) || file.id.substring(0,12)}... (No metadata)</span>
           ) : (
              <span>{extractVideoId(file.name) || file.id.substring(0, 12)}...</span>
          )}
        </div>
        {hasHashtags && (
          <div className="text-xs text-blue-500 dark:text-blue-400 mt-0.5 truncate">
            {hashtagsArray.slice(0, 3).join(' ')}
            {hashtagsArray.length > 3 ? ' ...' : ''}
          </div>
        )}
        {!loading && videoData && !hasHashtags && (
            <div className="text-xs text-gray-400 mt-0.5">No hashtags.</div>
        )}
      </div>
    </div>
  );
} 