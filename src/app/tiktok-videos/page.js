'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useUser } from '@/contexts/UserContext';
import { useTikTok } from '@/contexts/TikTokContext';
import PageContainer from '@/components/PageContainer';
import { FaSpinner, FaExternalLinkAlt, FaYoutube, FaGoogle } from 'react-icons/fa';
import { HiOutlineHashtag } from 'react-icons/hi';
import Link from 'next/link';

export default function TikTokVideosPage() {
  const [isMounted, setIsMounted] = useState(false);
  
  // Use useEffect to mark component as mounted
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Show loading spinner while mounting
  if (!isMounted) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-blue-500 mx-auto mb-4" size={36} />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }
  
  return <TikTokVideosContent />;
}

// Custom styles for RTL scrolling
const rtlScrollStyles = `
  .rtl-scroll {
    direction: rtl;
    overflow-x: auto;
    padding-bottom: 1rem;
  }
  
  .rtl-scroll > div {
    direction: ltr;
  }
  
  /* For mobile screens, ensure cards are wide enough to scroll */
  @media (max-width: 768px) {
    .rtl-scroll .video-card {
      min-width: 300px;
    }
  }
  
  /* Hide scrollbar for Chrome, Safari and Opera */
  .rtl-scroll::-webkit-scrollbar {
    display: none;
  }
  
  /* Hide scrollbar for IE, Edge and Firefox */
  .rtl-scroll {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
`;

// Separate content component that uses context hooks
function TikTokVideosContent() {
  const { data: session } = useSession();
  const { user } = useUser();
  const { savedVideos, refreshSavedVideos } = useTikTok();
  
  // Refresh videos when component mounts - only once
  useEffect(() => {
    if (session) {
      refreshSavedVideos();
    }
    // Don't include refreshSavedVideos in the dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
  
  // Determine loading state
  const loading = !savedVideos && session;

  return (
    <PageContainer user={user}>
      {/* Add RTL scroll styles */}
      <style dangerouslySetInnerHTML={{ __html: rtlScrollStyles }} />
      
      <div className="max-w-6xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2 dark:text-white">Your TikTok Videos</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Videos you've downloaded from TikTok and saved to your Google Drive
          </p>
        </div>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FaSpinner className="text-blue-500 animate-spin mb-4" size={32} />
            <p className="text-gray-600 dark:text-gray-400">Loading your TikTok videos...</p>
          </div>
        ) : !savedVideos ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 dark:bg-red-900/20 dark:border-red-800">
            <h3 className="text-red-800 dark:text-red-400 font-medium mb-2">Error Loading Videos</h3>
            <p className="text-red-700 dark:text-red-300">Could not load your videos. Please try again later.</p>
          </div>
        ) : savedVideos.length === 0 ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 dark:bg-blue-900/20 dark:border-blue-800">
            <h3 className="text-blue-800 dark:text-blue-400 font-medium mb-2">No Videos Found</h3>
            <p className="text-blue-700 dark:text-blue-300">
              You haven't downloaded any TikTok videos yet. Go to the TikTok Downloader to get started.
            </p>
          </div>
        ) : (
          <div className="rtl-scroll">
            <div className="flex flex-nowrap gap-6 pb-4">
              {savedVideos.map(video => (
                <div 
                  key={video.id} 
                  className="video-card flex-shrink-0 w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
                >
                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white line-clamp-2">
                      {video.title}
                    </h3>
                    
                    {video.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-3">
                        {video.description}
                      </p>
                    )}
                    
                    {video.hashtags && video.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {video.hashtags.map((tag, index) => (
                          <span 
                            key={index}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                          >
                            <HiOutlineHashtag className="mr-1" />
                            {tag.replace('#', '')}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex flex-col gap-2 mt-4">
                      {video.drive_file_id && (
                        <a
                          href={`https://drive.google.com/file/d/${video.drive_file_id}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <FaGoogle className="mr-2" />
                          View in Google Drive
                        </a>
                      )}
                      
                      {video.original_url && (
                        <a
                          href={video.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                        >
                          <FaExternalLinkAlt className="mr-2" />
                          View Original TikTok
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
                    Saved on {new Date(video.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
} 