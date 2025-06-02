'use client';

import { useState, useRef, useEffect } from 'react';
import { FaTiktok, FaDownload, FaExternalLinkAlt, FaTimes, FaVideo } from 'react-icons/fa';

export default function TikTokShareButton({ videoUrl, videoTitle, multipleVideos = false }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const modalRef = useRef(null);

  // Check if we have multiple videos based on title format
  const hasMultipleVideos = multipleVideos || (videoTitle && videoTitle.includes(' and '));
  
  // Extract count from title if in format "Video title and X more"
  const getVideoCount = () => {
    if (!videoTitle) return 1;
    const match = videoTitle.match(/ and (\d+) more$/);
    return match ? parseInt(match[1]) + 1 : 1;
  };
  
  const videoCount = getVideoCount();

  // Handle click outside to close modal
  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setIsModalOpen(false);
      }
    }

    if (isModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModalOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    function handleEscKey(event) {
      if (event.key === 'Escape') {
        setIsModalOpen(false);
      }
    }

    if (isModalOpen) {
      document.addEventListener('keydown', handleEscKey);
    }
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isModalOpen]);

  // Open TikTok app or website
  const openTikTok = () => {
    window.open('https://www.tiktok.com/upload', '_blank');
  };

  // Get clean title for display
  const getCleanTitle = () => {
    if (!videoTitle) return '';
    // Remove the "and X more" part if present
    return videoTitle.replace(/ and \d+ more$/, '');
  };

  return (
    <>
      {/* TikTok Share Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 bg-black hover:bg-gray-900 text-white px-4 py-2 rounded-md font-medium transition-all duration-300 hover:scale-105 shadow-md"
        disabled={!videoTitle}
        title={videoTitle ? `Share ${hasMultipleVideos ? 'videos' : 'video'} to TikTok` : 'No video selected'}
      >
        <FaTiktok className="text-[#25F4EE]" />
        <span>Share to TikTok</span>
        {hasMultipleVideos && (
          <span className="bg-[#25F4EE] text-black text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {videoCount}
          </span>
        )}
      </button>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          {/* Modal Content */}
          <div 
            ref={modalRef}
            className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full animate-fade-in"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <FaTiktok className="text-[#25F4EE] text-xl" />
                <h3 className="text-lg font-semibold text-black dark:text-white">Share to TikTok</h3>
                {hasMultipleVideos && (
                  <span className="bg-[#25F4EE] text-black text-xs rounded-full px-2 py-0.5 flex items-center gap-1">
                    <FaVideo size={10} />
                    {videoCount}
                  </span>
                )}
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <FaTimes />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6">
              <div className="mb-6 text-center">
                <div className="w-16 h-16 bg-[#25F4EE] rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaTiktok className="text-3xl text-black" />
                </div>
                <h4 className="text-lg font-medium text-black dark:text-white mb-2">
                  Coming Soon!
                </h4>
                <p className="text-gray-600 dark:text-gray-300">
                  This feature will let you upload directly to TikTok. We're working on making this available soon!
                </p>
              </div>
              
              {/* Video Preview */}
              {videoTitle && (
                <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {getCleanTitle()}
                    </p>
                    {hasMultipleVideos && (
                      <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-0.5 rounded-full">
                        +{videoCount - 1} more
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Alternative Options */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  In the meantime, you can:
                </h5>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Download Video Button */}
                  {videoUrl && (
                    <a 
                      href={videoUrl} 
                      download
                      className="flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-md font-medium transition-all duration-300 text-sm flex-1"
                    >
                      <FaDownload className="text-gray-600 dark:text-gray-300" />
                      <span>Download Video{hasMultipleVideos ? 's' : ''}</span>
                    </a>
                  )}
                  
                  {/* Open TikTok Button */}
                  <button
                    onClick={openTikTok}
                    className="flex items-center justify-center gap-2 bg-[#FE2C55] hover:bg-[#e62950] text-white px-4 py-2 rounded-md font-medium transition-all duration-300 text-sm flex-1"
                  >
                    <FaExternalLinkAlt />
                    <span>Open TikTok Manually</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-right">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-md text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 