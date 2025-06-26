'use client';

import { useState, useEffect } from 'react';
import { FaClock, FaCalendarAlt, FaBolt, FaTrash, FaEdit, FaCheck, FaSync, FaLayerGroup, FaHashtag, FaCalendarCheck, FaRegCalendar, FaRegCalendarAlt, FaRegClock } from 'react-icons/fa';
import { useScheduledUploads } from '@/contexts/ScheduledUploadsContext';
import Image from 'next/image';
import { Tooltip } from "@/components/ui/tooltip";
import { TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import DriveThumbnail from '@/components/DriveThumbnail';
import { processVideoTitle, generateCleanTitleFromFileName } from '@/utils/titleHelpers';
import { supabase } from '@/utils/supabase-client';
import TikTokShareButton from './TikTokShareButton';
import { sanitizeInput, validateInput, SecurityError, logSecurityEvent } from '@/utils/security';

// Add a custom app logo component for consistency
const AppLogoIcon = ({ className = "", size = 24 }) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    <Image 
      src="/android-chrome-192x192.png" 
      alt="App Logo"
      fill
      className="object-cover"
    />
  </div>
);

// Helper function to extract hashtags from text
const extractHashtags = (text) => {
  if (!text) return [];
  
  // For TikTok videos, extract the part after the ID
  let processedText = text;
  const tiktokMatch = text.match(/tiktok-(\d+)-(.+?)\.mp4$/i);
  if (tiktokMatch) {
    processedText = tiktokMatch[2];
  }
  
  // Match hashtags (words starting with # followed by letters/numbers)
  const hashtagRegex = /#[a-zA-Z0-9_]+/g;
  const matches = processedText.match(hashtagRegex) || [];
  
  // Also extract potential hashtags (words without the # symbol)
  const potentialTags = processedText
    .split(/[\s_-]+/)
    .filter(word => 
      // Only include words that look like hashtags (all lowercase, 3+ chars)
      word.length >= 3 && 
      /^[a-z0-9_]+$/i.test(word) && 
      !['fyp', 'foryou', 'foryoupage', 'tiktok', 'video'].includes(word.toLowerCase())
    )
    .map(word => `#${word.toLowerCase()}`);
  
  // Combine both types of hashtags
  const allTags = [...matches, ...potentialTags];
  
  // Return unique hashtags
  return [...new Set(allTags)];
};

// Helper function to get the next available time (tomorrow at noon)
const getNextAvailableTime = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(12, 0, 0, 0); // Set to noon tomorrow
  return tomorrow;
};

// Helper function to extract TikTok video_id from file name
const extractVideoId = (fileName) => {
  if (!fileName) return null;
  const match = fileName.match(/(?:Tiktok\s?)?(\d{19})/);
  return match ? match[1] : null;
};

// Helper function to fetch video details from Supabase
const fetchVideoDetailsFromSupabase = async (fileName) => {
  const videoId = extractVideoId(fileName);
  if (!videoId) return null;
  
  try {
    const { data, error } = await supabase
      .from('tiktok_videos')
      .select('title, description, hashtags')
      .eq('video_id', videoId)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching video details from Supabase:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Exception fetching video details from Supabase:', err);
    return null;
  }
};

// Helper function to initialize file data
const initializeFileData = async (file) => {
  // أولاً نحاول جلب البيانات من Supabase
  const supabaseData = await fetchVideoDetailsFromSupabase(file.name);
  
  // استخدام بيانات Supabase إذا وجدت
  if (supabaseData) {
    console.log('Found data in Supabase for:', file.name, supabaseData);
    return {
      fileId: file.id,
      fileName: file.name,
      title: supabaseData.title || generateCleanTitleFromFileName(file.name),
      description: supabaseData.description || '',
      hashtags: supabaseData.hashtags || extractHashtags(file.name),
      scheduledDateTime: getNextAvailableTime().toISOString().slice(0, 16),
      selected: true,
      rowError: null,
      thumbnailLink: file.thumbnailLink || null,
      videoId: extractVideoId(file.name)
    };
  }
  
  // التحقق من بيانات TikTok المباشرة أو بيانات مخزنة في الملف
  let title = '';
  let description = '';
  let hashtags = [];
  
  if (file.tiktokData) {
    title = file.tiktokData.title || generateCleanTitleFromFileName(file.name);
    description = file.tiktokData.description || '';
    hashtags = file.tiktokData.hashtags || extractHashtags(title);
  } 
  // التحقق من وجود بيانات TikTok في خصائص tikTok المضافة
  else if (file.tikTokData) {
    title = file.tikTokTitle || file.tikTokData.title || generateCleanTitleFromFileName(file.name);
    description = file.tikTokDescription || file.tikTokData.description || '';
    hashtags = file.tikTokHashtags || file.tikTokData.hashtags || extractHashtags(title);
  }
  // استخدام القيم الافتراضية إذا لم تكن هناك بيانات TikTok
  else {
    title = generateCleanTitleFromFileName(file.name);
    hashtags = extractHashtags(title);
  }
  
  return {
    fileId: file.id,
    fileName: file.name,
    title: title.includes('#Shorts') ? title : `${title} #Shorts`,
    description: description,
    hashtags: hashtags,
    scheduledDateTime: getNextAvailableTime().toISOString().slice(0, 16),
    selected: true,
    rowError: null,
    thumbnailLink: file.thumbnailLink || null,
    videoId: extractVideoId(file.name)
  };
};

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
  const [simpleTimeFormat, setSimpleTimeFormat] = useState({}); // Track which rows use simple time format
  const [schedulingInfo, setSchedulingInfo] = useState(null);
  const [processedTitlePreviews, setProcessedTitlePreviews] = useState({});

  const { scheduleUpload, loading } = useScheduledUploads();

  const getDefaultScheduledTime = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const offset = tomorrow.getTimezoneOffset() * 60000;
    const localTomorrow = new Date(tomorrow.getTime() - offset);
    return localTomorrow.toISOString().slice(0, 16);
  };

  useEffect(() => {
    const loadFilesData = async () => {
      if (file) {
        const fileData = await initializeFileData(file);
        setFilesData([fileData]);
      } else if (multipleFiles && multipleFiles.length > 0) {
        const processedFilesData = [];
        
        // Process files sequentially to avoid too many parallel requests
        for (const fileItem of multipleFiles) {
          const fileData = await initializeFileData(fileItem);
          processedFilesData.push(fileData);
        }
        
        setFilesData(processedFilesData);
      }
    };
    
    loadFilesData();
  }, [file, multipleFiles]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDisplayTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleInputChange = (index, field, value) => {
    try {
      // تطبيق التأمين على المدخلات حسب نوع الحقل
      let sanitizedValue = value;
      
      if (field === 'title' || field === 'description') {
        // تنظيف HTML والمحتوى الخطير من العنوان والوصف
        sanitizedValue = sanitizeInput.html(value);
        
        // التحقق من طول العنوان
        if (field === 'title' && sanitizedValue.length > 500) {
          logSecurityEvent('LONG_TITLE_INPUT', { 
            originalLength: value.length, 
            sanitizedLength: sanitizedValue.length,
            fileIndex: index 
          });
          sanitizedValue = sanitizedValue.substring(0, 500);
        }
        
        // التحقق من طول الوصف
        if (field === 'description' && sanitizedValue.length > 5000) {
          logSecurityEvent('LONG_DESCRIPTION_INPUT', { 
            originalLength: value.length, 
            sanitizedLength: sanitizedValue.length,
            fileIndex: index 
          });
          sanitizedValue = sanitizedValue.substring(0, 5000);
        }
      }
      
      // التحقق من صحة التاريخ والوقت
      if (field === 'scheduledDateTime' && sanitizedValue) {
        const scheduledDate = new Date(sanitizedValue);
        if (isNaN(scheduledDate.getTime())) {
          logSecurityEvent('INVALID_DATE_INPUT', { 
            value: sanitizedValue,
            fileIndex: index 
          });
          throw new SecurityError('Invalid date format provided', 'INVALID_DATE');
        }
        
        // التحقق من أن التاريخ ليس في الماضي البعيد أو المستقبل البعيد
        const now = new Date();
        const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        
        if (scheduledDate < oneYearAgo || scheduledDate > oneYearFromNow) {
          logSecurityEvent('SUSPICIOUS_DATE_RANGE', { 
            scheduledDate: scheduledDate.toISOString(),
            fileIndex: index 
          });
        }
      }
      
      setFilesData(prevData => {
        const newData = [...prevData];
        newData[index] = { ...newData[index], [field]: sanitizedValue, rowError: null };
        
        if (field === 'title' && sanitizedValue.length > 100) {
          const processedTitle = processVideoTitle(sanitizedValue);
          setProcessedTitlePreviews(prev => ({
            ...prev,
            [index]: processedTitle
          }));
        } else if (field === 'title') {
          setProcessedTitlePreviews(prev => {
            const newPreviews = { ...prev };
            delete newPreviews[index];
            return newPreviews;
          });
        }
        
        return newData;
      });
      
      // Clear global validation error when any input changes
      setValidationError(null); 
      setGeneralError(null);
      
    } catch (error) {
      if (error instanceof SecurityError) {
        setGeneralError(`Security validation failed: ${error.message}`);
        logSecurityEvent('INPUT_SECURITY_ERROR', { 
          field, 
          error: error.message, 
          fileIndex: index 
        });
      } else {
        console.error('Unexpected error in handleInputChange:', error);
        setGeneralError('An unexpected error occurred while processing your input.');
      }
    }
  };

  // New function to add hashtags to description
  const addHashtagsToDescription = (index) => {
    setFilesData(prevData => {
      const newData = [...prevData];
      const file = newData[index];
      
      // Extract hashtags from title
      const titleHashtags = extractHashtags(file.title);
      
      // Combine with existing hashtags
      const allHashtags = [...new Set([...file.hashtags, ...titleHashtags])];
      
      // Create description with hashtags
      let description = file.description || '';
      
      // Remove existing hashtags at the end of description
      description = description.replace(/(\n\n)?#[a-zA-Z0-9_\s]+$/g, '');
      
      // Add hashtags if we have any
      if (allHashtags.length > 0) {
        description = description.trim() + '\n\n' + allHashtags.join(' ');
      }
      
      newData[index] = { 
        ...file, 
        description, 
        hashtags: allHashtags 
      };
      
      return newData;
    });
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

  // Parse simple time format like "3pm" or "15:30" 
  const parseSimpleTime = (timeStr, index) => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let hours = 0;
      let minutes = 0;
      
      // Clean input
      const cleanTime = timeStr.trim().toLowerCase();
      
      // Check AM/PM
      const isPM = cleanTime.includes('pm');
      const cleanerTime = cleanTime.replace(/am|pm/g, '').trim();
      
      // Check hour:minute format
      if (cleanerTime.includes(':')) {
        const [hoursStr, minsStr] = cleanerTime.split(':');
        hours = parseInt(hoursStr);
        minutes = parseInt(minsStr) || 0;
      } else {
        hours = parseInt(cleanerTime);
        minutes = 0;
      }
      
      // Convert 12-hour to 24-hour
      if (isPM && hours < 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      
      // Apply time to current date
      today.setHours(hours, minutes, 0, 0);
      
      // Check if time is in the past, schedule for tomorrow if so
      if (today < now) {
        today.setDate(today.getDate() + 1);
      }
      
      // Handle timezone offset
      const offset = today.getTimezoneOffset() * 60000;
      const localDate = new Date(today.getTime() - offset);
      const formattedDateTime = localDate.toISOString().slice(0, 16);
      
      // Update state
      handleInputChange(index, 'scheduledDateTime', formattedDateTime);
    } catch (error) {
      console.error('Error parsing simple time format:', error);
      // Don't change value on error
    }
  };

  // Modified function to apply staggered scheduling based on custom start hour and interval
  // and display date information
  const applyStaggeredScheduling = () => {
    if (filesData.length === 0) return;
    
    // Create a base date that's today with custom start hour and minutes/seconds set to 00:00
    const now = new Date();
    const baseDate = new Date(now);
    baseDate.setHours(startHour); // Use the custom start hour
    baseDate.setMinutes(0);
    baseDate.setSeconds(0);
    
    // Calculate the end date
    const lastIndex = filesData.length - 1;
    const endDate = new Date(baseDate);
    // Add the total hours for the last video
    endDate.setHours(baseDate.getHours() + (lastIndex * hourInterval));
    
    // Calculate total days between start and end date
    const daysDifference = Math.floor((endDate - baseDate) / (1000 * 60 * 60 * 24));
    
    // Show summary info for multiple videos
    if (filesData.length > 1) {
      const infoMessage = `Scheduling ${filesData.length} videos from ${baseDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} (${daysDifference} day${daysDifference !== 1 ? 's' : ''} total)`;
      setGeneralError(null); // Clear any previous errors
      // Use state to show scheduling info
      setSchedulingInfo({
        startDate: baseDate.toLocaleDateString(),
        endDate: endDate.toLocaleDateString(),
        daysDifference,
        totalVideos: filesData.length
      });
    } else {
      setSchedulingInfo(null);
    }
    
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
    try {
      if (!batchTitle.trim()) return;
      
      // تطبيق التأمين على العنوان المجمع
      const sanitizedTitle = sanitizeInput.html(batchTitle.trim());
      
      if (sanitizedTitle.length > 500) {
        logSecurityEvent('BATCH_TITLE_TOO_LONG', { 
          originalLength: batchTitle.length, 
          sanitizedLength: sanitizedTitle.length 
        });
        setGeneralError('Batch title is too long. Maximum 500 characters allowed.');
        return;
      }
      
      if (sanitizedTitle.length === 0) {
        logSecurityEvent('BATCH_TITLE_EMPTY_AFTER_SANITIZATION', { 
          originalTitle: batchTitle 
        });
        setGeneralError('Title contains only invalid characters.');
        return;
      }
      
      setFilesData(prevData => {
        return prevData.map(file => ({
          ...file,
          title: sanitizedTitle
        }));
      });
      
      logSecurityEvent('BATCH_TITLE_APPLIED', { 
        fileCount: filesData.length, 
        titleLength: sanitizedTitle.length 
      });
      
    } catch (error) {
      console.error('Error applying batch title:', error);
      setGeneralError('Failed to apply batch title. Please try again.');
    }
  };

  // New function to apply the same description to all files
  const applyBatchDescription = () => {
    try {
      if (!batchDescription.trim()) return;
      
      // تطبيق التأمين على الوصف المجمع
      const sanitizedDescription = sanitizeInput.html(batchDescription.trim());
      
      if (sanitizedDescription.length > 5000) {
        logSecurityEvent('BATCH_DESCRIPTION_TOO_LONG', { 
          originalLength: batchDescription.length, 
          sanitizedLength: sanitizedDescription.length 
        });
        setGeneralError('Batch description is too long. Maximum 5000 characters allowed.');
        return;
      }
      
      setFilesData(prevData => {
        return prevData.map(file => ({
          ...file,
          description: sanitizedDescription
        }));
      });
      
      logSecurityEvent('BATCH_DESCRIPTION_APPLIED', { 
        fileCount: filesData.length, 
        descriptionLength: sanitizedDescription.length 
      });
      
    } catch (error) {
      console.error('Error applying batch description:', error);
      setGeneralError('Failed to apply batch description. Please try again.');
    }
  };

  const validateForm = () => {
    let isValid = true;
    let globalErrorMsg = '';
    let securityIssues = [];
    
    const updatedFilesData = filesData.map((video, index) => {
      let rowError = null;
      
      try {
        // التحقق من وجود العنوان وصحته
        if (!video.title || !video.title.trim()) {
          rowError = 'Title is required.';
          isValid = false;
        } else {
          // التحقق من طول العنوان
          if (video.title.length > 500) {
            rowError = 'Title is too long (max 500 characters).';
            isValid = false;
            securityIssues.push(`Video ${index + 1}: Title exceeds maximum length`);
          }
          
          // التحقق من المحتوى المشبوه في العنوان
          const suspiciousPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+\s*=/i,
            /data:text\/html/i
          ];
          
          if (suspiciousPatterns.some(pattern => pattern.test(video.title))) {
            rowError = 'Title contains invalid content.';
            isValid = false;
            securityIssues.push(`Video ${index + 1}: Suspicious content in title`);
            logSecurityEvent('SUSPICIOUS_TITLE_CONTENT', { 
              title: video.title, 
              fileIndex: index,
              fileName: video.fileName 
            });
          }
        }
        
        // التحقق من الوصف
        if (video.description && video.description.length > 5000) {
          rowError = (rowError ? rowError + ' ' : '') + 'Description is too long (max 5000 characters).';
          isValid = false;
          securityIssues.push(`Video ${index + 1}: Description exceeds maximum length`);
        }
        
        // التحقق من التاريخ والوقت المجدول
        if (!video.scheduledDateTime) {
          rowError = (rowError ? rowError + ' ' : '') + 'Schedule time is required.';
          isValid = false;
        } else {
          const scheduledDate = new Date(video.scheduledDateTime);
          
          // التحقق من صحة التاريخ
          if (isNaN(scheduledDate.getTime())) {
            rowError = (rowError ? rowError + ' ' : '') + 'Invalid date format.';
            isValid = false;
            securityIssues.push(`Video ${index + 1}: Invalid date format`);
          } else {
            // التحقق من أن التاريخ في المستقبل
            if (scheduledDate <= new Date(Date.now() - 60000)) {
              rowError = (rowError ? rowError + ' ' : '') + 'Time must be in future.';
              isValid = false;
            }
            
            // التحقق من النطاق المعقول للتاريخ
            const now = new Date();
            const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
            
            if (scheduledDate > oneYearFromNow) {
              securityIssues.push(`Video ${index + 1}: Scheduled date is more than 1 year in the future`);
              logSecurityEvent('SUSPICIOUS_FUTURE_DATE', { 
                scheduledDate: scheduledDate.toISOString(),
                fileIndex: index,
                fileName: video.fileName 
              });
            }
          }
        }
        
        // التحقق من معرف الملف
        if (!video.fileId || typeof video.fileId !== 'string') {
          rowError = (rowError ? rowError + ' ' : '') + 'Invalid file reference.';
          isValid = false;
          securityIssues.push(`Video ${index + 1}: Invalid file ID`);
        } else if (!validateInput.driveFileId(video.fileId)) {
          logSecurityEvent('INVALID_DRIVE_FILE_ID', { 
            fileId: video.fileId,
            fileIndex: index,
            fileName: video.fileName 
          });
        }
        
      } catch (error) {
        console.error(`Validation error for video ${index}:`, error);
        rowError = 'Validation failed for this video.';
        isValid = false;
        securityIssues.push(`Video ${index + 1}: Validation exception`);
      }
      
      return { ...video, rowError };
    });

    setFilesData(updatedFilesData);

    // تسجيل المشاكل الأمنية إذا وجدت
    if (securityIssues.length > 0) {
      logSecurityEvent('FORM_VALIDATION_SECURITY_ISSUES', { 
        issues: securityIssues,
        totalVideos: filesData.length 
      });
    }

    if (!isValid) {
      const firstErrorRow = updatedFilesData.find(v => v.rowError);
      if (firstErrorRow) {
        globalErrorMsg = `Error with ${sanitizeInput.html(firstErrorRow.fileName)}: ${firstErrorRow.rowError} (and possibly others).`;
      } else {
        globalErrorMsg = 'Please correct the errors in the form.';
      }
      setValidationError(globalErrorMsg);
    } else {
      setValidationError(null);
    }
    
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError(null);
    
    try {
      // التحقق من صحة النموذج أولاً
      if (!validateForm()) {
        logSecurityEvent('FORM_SUBMISSION_VALIDATION_FAILED', { 
          totalVideos: filesData.length 
        });
        return;
      }

      const uploadsToAttempt = filesData.filter(f => f.selected);

      if (uploadsToAttempt.length === 0) {
        setGeneralError("No files selected for upload.");
        logSecurityEvent('FORM_SUBMISSION_NO_FILES_SELECTED', { 
          totalVideos: filesData.length 
        });
        return;
      }

      // التحقق من الحد الأقصى لعدد الملفات المرفوعة في المرة الواحدة
      if (uploadsToAttempt.length > 50) {
        setGeneralError("Too many files selected. Maximum 50 files allowed per batch.");
        logSecurityEvent('EXCESSIVE_BATCH_SIZE', { 
          attemptedCount: uploadsToAttempt.length 
        });
        return;
      }

      logSecurityEvent('FORM_SUBMISSION_STARTED', { 
        fileCount: uploadsToAttempt.length,
        totalVideos: filesData.length 
      });

      // Process uploads one by one to give better feedback or handle partial failures
      let successfulUploads = 0;
      let failedUploads = [];

      for (const videoData of uploadsToAttempt) {
        try {
          // التحقق النهائي من البيانات قبل الإرسال
          const sanitizedData = {
            fileId: videoData.fileId,
            fileName: sanitizeInput.filename(videoData.fileName),
            title: sanitizeInput.html(videoData.title),
            description: sanitizeInput.html(videoData.description || ''),
            scheduledTime: new Date(videoData.scheduledDateTime).toISOString(),
          };

          // التحقق من صحة معرف الملف
          if (!validateInput.driveFileId(sanitizedData.fileId)) {
            throw new SecurityError('Invalid file ID format', 'INVALID_FILE_ID');
          }

          const result = await scheduleUpload(sanitizedData);
          
          if (result && result.success !== false) {
            successfulUploads++;
            logSecurityEvent('VIDEO_SCHEDULED_SUCCESS', { 
              fileId: sanitizedData.fileId,
              fileName: sanitizedData.fileName 
            });
          } else {
            const errorMsg = (result && result.error) || 'Unknown error';
            failedUploads.push({
              name: sanitizedData.fileName, 
              error: errorMsg
            });
            
            // Update rowError for the specific file that failed
            setFilesData(prev => prev.map(f => 
              f.fileId === videoData.fileId 
                ? {...f, rowError: `Schedule failed: ${errorMsg}`} 
                : f
            ));
            
            logSecurityEvent('VIDEO_SCHEDULED_FAILED', { 
              fileId: sanitizedData.fileId,
              fileName: sanitizedData.fileName,
              error: errorMsg 
            });
          }
        } catch (videoError) {
          const errorMsg = videoError instanceof SecurityError 
            ? `Security error: ${videoError.message}` 
            : 'Processing failed';
            
          failedUploads.push({
            name: videoData.fileName, 
            error: errorMsg
          });
          
          setFilesData(prev => prev.map(f => 
            f.fileId === videoData.fileId 
              ? {...f, rowError: errorMsg} 
              : f
          ));
          
          logSecurityEvent('VIDEO_PROCESSING_ERROR', { 
            fileId: videoData.fileId,
            fileName: videoData.fileName,
            error: videoError.message 
          });
        }
      }

      // تسجيل النتائج النهائية
      logSecurityEvent('FORM_SUBMISSION_COMPLETED', { 
        successfulUploads,
        failedUploads: failedUploads.length,
        totalAttempted: uploadsToAttempt.length 
      });

      if (failedUploads.length > 0) {
        setGeneralError(`Scheduled ${successfulUploads} video(s). Failed to schedule ${failedUploads.length} video(s). Check errors below.`);
      } else if (successfulUploads > 0) {
        if (onScheduled) {
          onScheduled({ count: successfulUploads });
        }
      } else {
        setGeneralError('No videos were scheduled. Please try again.');
      }

    } catch (error) {
      console.error('Error scheduling uploads:', error);
      const errorMessage = error instanceof SecurityError 
        ? `Security validation failed: ${error.message}` 
        : 'An unexpected error occurred during scheduling.';
      
      setGeneralError(errorMessage);
      
      logSecurityEvent('FORM_SUBMISSION_ERROR', { 
        error: error.message,
        errorType: error.constructor.name 
      });
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

  // Get the currently selected videos for TikTok sharing
  const getSelectedVideos = () => {
    return filesData.filter(f => f.selected);
  };

  // Get the first selected video or null
  const getFirstSelectedVideo = () => {
    const selected = getSelectedVideos();
    return selected.length > 0 ? selected[0] : null;
  };
  
  // Get count of selected videos
  const getSelectedCount = () => {
    return getSelectedVideos().length;
  };

  if (!filesData.length) {
    if (multipleFiles.length === 0 && !file) {
        return <p className="text-gray-600 dark:text-gray-400">No files selected for scheduling.</p>;
    }
    return null; 
  }

  return (
    <div className="bg-gradient-to-br from-white to-blue-50 dark:from-black dark:to-black rounded-xl shadow-xl max-w-full border border-blue-100 dark:border-gray-700 transition-all p-1">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Header with responsive styling */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 dark:from-blue-800 dark:to-blue-700 text-white p-3 sm:p-4 rounded-t-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center justify-between w-full">
              <h3 className="text-xl font-bold flex items-center flex-wrap">
                <FaCalendarAlt className="mr-2 text-white text-lg" />
                <span>Schedule Uploads</span>
                <span className="ml-2 px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full flex items-center">
                  {filesData.length} {filesData.length === 1 ? 'video' : 'videos'}
                </span>
              </h3>
              
              {/* TikTok Share Button */}
              <div className="flex items-center">
                {filesData.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/80">
                      {getSelectedCount() > 0 ? (
                        getSelectedCount() === 1 ? 
                          '1 video selected' : 
                          `${getSelectedCount()} videos selected`
                      ) : 'No videos selected'}
                    </span>
                    <TikTokShareButton 
                      videoUrl={getFirstSelectedVideo()?.fileId ? `/api/drive/download?fileId=${getFirstSelectedVideo()?.fileId}` : null}
                      videoTitle={getSelectedCount() > 1 
                        ? `${getFirstSelectedVideo()?.title || getFirstSelectedVideo()?.fileName} and ${getSelectedCount() - 1} more` 
                        : getFirstSelectedVideo()?.title || getFirstSelectedVideo()?.fileName}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center text-xs text-blue-100 bg-black/10 px-3 py-1.5 rounded-lg">
              <FaClock className="mr-1.5 animate-pulse" />
              {formatCurrentDateTime()}
            </div>
          </div>
        </div>

        <div className="px-2 sm:px-4">
          {validationError && (
            <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-md text-sm animate-pulse">
              {validationError}
            </div>
          )}
          
          {generalError && (
            <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-md text-sm animate-pulse">
              {generalError}
            </div>
          )}

          {/* Show scheduling info when multiple videos are selected */}
          {schedulingInfo && (
            <div className="mb-4 p-3 bg-blue-100 border-l-4 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-md text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="flex items-center">
                  <FaCalendarCheck className="mr-2 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="font-semibold truncate">Scheduling {schedulingInfo.totalVideos} videos</span>
                </div>
                <div className="flex items-center">
                  <FaRegCalendar className="mr-2 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate">Start: {schedulingInfo.startDate}</span>
                </div>
                <div className="flex items-center">
                  <FaRegCalendarAlt className="mr-2 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate">End: {schedulingInfo.endDate}</span>
                </div>
                <div className="flex items-center">
                  <FaClock className="mr-2 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate">Duration: {schedulingInfo.daysDifference} day{schedulingInfo.daysDifference !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Batch operations panel - always visible now */}
        <div className="mx-2 sm:mx-4">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100/30 dark:from-gray-900 dark:to-black border border-blue-100 dark:border-gray-600 rounded-lg p-4 mb-4 shadow-inner">
            {/* Staggered Scheduling Header */}
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-blue-500 rounded-lg text-white">
                <FaRegClock />
              </div>
              <h4 className="font-semibold text-blue-700 dark:text-blue-400">Staggered Scheduling</h4>
            </div>
            
            {/* Staggered Scheduling Content */}
            <div>
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 flex flex-col sm:flex-row gap-3">
                  {/* Start Hour Input */}
                  <div className="sm:flex-1">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Hour (24h)</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
                        <input 
                          type="number" 
                          min="0" 
                          max="23"
                          value={startHour} 
                          onChange={(e) => setStartHour(parseInt(e.target.value) || 0)}
                          className="w-full sm:w-20 px-2 py-1 border border-gray-200 dark:border-gray-600 dark:bg-black dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">:00</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          setStartHour(now.getHours());
                        }}
                        className="px-3 py-2 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm mt-2 sm:mt-0"
                        title="Set to current hour"
                      >
                        <FaBolt size={10} className="animate-pulse" /> Now
                      </button>
                    </div>
                  </div>
                  
                  {/* Hours Between Videos Input */}
                  <div className="sm:flex-1">
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
                        className="w-full sm:w-20 px-2 py-1 border border-gray-200 dark:border-gray-600 dark:bg-black dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">hours</span>
                    </div>
                  </div>
                </div>
                
                {/* Apply Button */}
                <button
                  type="button"
                  onClick={applyStaggeredScheduling}
                  className="w-full lg:w-auto px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg flex items-center justify-center gap-2 transition-colors lg:self-end"
                >
                  <FaSync className="text-xs" /> 
                  <span>Apply Interval</span>
                </button>
              </div>
            </div>
            
            {/* Visual Indicator for Staggered Schedule */}
            {filesData.length > 1 && (
              <div className="mt-4 pt-3 border-t border-blue-200 dark:border-gray-700">
                <div className="overflow-x-auto -mx-2 px-2">
                  <div className="flex items-center gap-1 min-w-max">
                    {filesData.map((_, idx) => (
                      <div key={idx} className="flex flex-col items-center">
                        <div 
                          className={`w-4 h-4 rounded-full ${idx === 0 ? 'bg-green-500' : idx === filesData.length - 1 ? 'bg-red-500' : 'bg-blue-500'}`}
                        />
                        {idx < filesData.length - 1 && (
                          <div className="h-0.5 w-8 bg-gray-300 dark:bg-gray-600" />
                        )}
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 rotate-45 sm:rotate-0">
                          +{idx * hourInterval}h
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Batch Title and Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Set Title For All Videos</label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <input 
                    type="text" 
                    value={batchTitle} 
                    onChange={(e) => setBatchTitle(e.target.value)}
                    placeholder="Common title for all videos"
                    className="flex-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-black dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={applyBatchTitle}
                    disabled={!batchTitle.trim()}
                    className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[90px] justify-center"
                  >
                    <FaCheck className="text-xs" /> Apply
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Set Description For All Videos</label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <input 
                    type="text" 
                    value={batchDescription} 
                    onChange={(e) => setBatchDescription(e.target.value)}
                    placeholder="Common description for all videos"
                    className="flex-1 w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-black dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={applyBatchDescription}
                    disabled={!batchDescription.trim()}
                    className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[90px] justify-center"
                  >
                    <FaCheck className="text-xs" /> Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-2">
          <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-1 pb-2">
            {filesData.map((video, index) => (
              <div 
                key={video.fileId} 
                className={`${
                  video.rowError 
                    ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' 
                    : 'bg-white border-gray-200 dark:bg-black dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                } rounded-lg border shadow-md p-4 transition-all hover:shadow-lg`}
              >
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Video thumbnail and info */}
                  <div className="flex items-center md:w-[220px]">
                    <div className="h-16 w-24 bg-gray-100 dark:bg-gray-900 rounded-md overflow-hidden flex items-center justify-center shadow-sm">
                      {video.thumbnailLink ? (
                        <DriveThumbnail 
                          src={video.thumbnailLink} 
                          alt={video.fileName} 
                          width={96} 
                          height={64} 
                          fallbackText={video.fileName}
                          className="h-full w-full object-cover" 
                        />
                      ) : (
                        <AppLogoIcon className="text-red-500" size={32} /> 
                      )}
                    </div>
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-800 dark:text-white truncate max-w-[150px]" title={video.fileName}>
                        {generateCleanTitleFromFileName(video.fileName)}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(video.fileId)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs flex items-center gap-1 hover:underline"
                        >
                          <FaTrash size={10} /> Remove
                        </button>
                        {video.hashtags && video.hashtags.length > 0 && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <FaHashtag size={8} /> {video.hashtags.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Form fields */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                      <input
                        type="text"
                        value={video.title}
                        onChange={(e) => handleInputChange(index, 'title', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-black dark:text-white transition-all ${video.rowError && video.rowError.includes('Title') ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'}`}
                        placeholder="Video Title"
                      />
                      {processedTitlePreviews[index] && (
                        <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                          <span className="font-semibold">تنبيه:</span> العنوان طويل جدًا (أكثر من 100 حرف). سيتم اختصاره إلى:
                          <div className="p-2 mt-1 bg-amber-50 dark:bg-amber-900/30 rounded border border-amber-200 dark:border-amber-800">
                            {processedTitlePreviews[index]}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                      </div>
                      <textarea
                        value={video.description}
                        onChange={(e) => handleInputChange(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-black dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                        rows="2" 
                        placeholder="Description (optional)"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Schedule Time</label>
                     
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="datetime-local"
                            value={video.scheduledDateTime}
                            onChange={(e) => handleInputChange(index, 'scheduledDateTime', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-black dark:text-white transition-all ${video.rowError && video.rowError.includes('Schedule time') ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'}`}
                          />
                          {video.scheduledDateTime && 
                            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                              Scheduled for: {formatDateTimeForDisplay(video.scheduledDateTime)}
                            </p>
                          }
                        </div>
                        <button
                          type="button"
                          onClick={() => setToNowForRow(index)}
                          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                          title="Set to current time"
                        >
                          <FaBolt size={10} className="animate-pulse" /> Now
                        </button>
                      </div>
                      
                      <div className="h-5">
                        {video.rowError && (
                          <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                            {video.rowError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer actions area with improved responsive design */}
        <div className="bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black p-3 sm:p-4 rounded-b-xl border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
            <FaRegClock className="mr-1.5" /> 
            <span>Videos will be uploaded to your YouTube channel at the scheduled times</span>
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-black border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 dark:focus:ring-offset-gray-900 transition-all duration-300 shadow-sm hover:shadow flex items-center justify-center"
            >
              <span className="mr-1.5">Cancel</span>
            </button>
            <button
              type="submit"
              disabled={loading || filesData.length === 0}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm transition-all duration-300 shadow-md hover:shadow-lg"
            >
              {loading ? (
                <>
                  <FaClock className="animate-spin" /> 
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <FaCalendarAlt />
                  <span>Schedule {filesData.length > 0 ? filesData.length : ''} {filesData.length === 1 ? 'Video' : 'Videos'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}