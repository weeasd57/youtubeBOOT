'use client';

import { useState } from 'react';
import { FaFileVideo } from 'react-icons/fa';
import DriveThumbnail from './DriveThumbnail';

export default function FileListItem({ 
  file, 
  onSchedule, 
  className = ''
}) {
  const [hovered, setHovered] = useState(false);

  // استخدام عنوان من بيانات TikTok أو اسم الملف
  const displayTitle = file.tiktokData?.title || file.name;
  
  // تحقق من وجود وصف من بيانات TikTok
  const hasDescription = file.tiktokData?.description && file.tiktokData.description.trim().length > 0;
  
  // تحقق من وجود هاشتاجات من بيانات TikTok
  const hasHashtags = file.tiktokData?.hashtags && file.tiktokData.hashtags.length > 0;

  return (
    <div 
      className={`relative flex flex-col w-full transition-all ${
        hovered ? 'bg-gray-50 dark:bg-gray-900/30' : ''
      } ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* الصورة المصغرة */}
      <div className="w-full flex justify-center mb-2">
        <DriveThumbnail 
          src={file.thumbnailLink} 
          alt={displayTitle}
          width={120} 
          height={120} 
          className="rounded-md"
          fallbackText={displayTitle.substring(0, 1).toUpperCase()}
        />
      </div>
      
      {/* معلومات الملف */}
      <div className="w-full">
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={displayTitle}>
          {displayTitle}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {hasDescription ? (
            <span className="inline-flex items-center">
              <span className="truncate max-w-full inline-block" title={file.tiktokData.description}>
                {file.tiktokData.description.substring(0, 50)}
                {file.tiktokData.description.length > 50 ? '...' : ''}
              </span>
            </span>
          ) : (
            <span>{file.id.substring(0, 12)}...</span>
          )}
        </div>
        {hasHashtags && (
          <div className="text-xs text-blue-500 dark:text-blue-400 mt-0.5 truncate">
            {file.tiktokData.hashtags.slice(0, 3).join(' ')}
            {file.tiktokData.hashtags.length > 3 ? ' ...' : ''}
          </div>
        )}
      </div>
    </div>
  );
} 