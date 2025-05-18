'use client';

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { FaGoogle, FaYoutube, FaFileVideo, FaCode, FaTimes } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import ClientOnly from '@/components/ClientOnly';
import ThemeToggle from '@/components/ThemeToggle';
import AuthErrorBanner from '@/components/AuthErrorBanner';
import JsonSampleDialog from '@/components/JsonSampleDialog';
import Image from "next/image";
import { useYouTubeChannel } from '@/contexts/YouTubeChannelContext';

export default function LandingPage() {
  // Handle client-side mounting to prevent hydration issues
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Don't render anything on the server or during initial mount
  if (!isMounted) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center dark:bg-black" suppressHydrationWarning>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-amber-500" suppressHydrationWarning></div>
      </div>
    );
  }
  
  // Render client-side content
  return <LandingPageContent />;
}

// Client-only component with full functionality
function LandingPageContent() {
  const { data: session, status, error: authError } = useSession();
  const router = useRouter();
  const [showJsonSample, setShowJsonSample] = useState(false);
  const { refreshConnection, connectionStatus, error: channelError } = useYouTubeChannel();

  // Redirect to home page if authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/home');
    }
  }, [status, router]);

  // Initialize YouTube channel connection if authenticated
  useEffect(() => {
    if (status === 'authenticated' && connectionStatus === 'unknown') {
      refreshConnection(true).catch(err => {
        console.error('Failed to refresh YouTube connection:', err);
      });
    }
  }, [status, connectionStatus, refreshConnection]);

  // Show loading spinner while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center dark:bg-black" suppressHydrationWarning>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-amber-500" suppressHydrationWarning></div>
      </div>
    );
  }

  // Using static year to avoid hydration issues with Date functions
  const currentYear = 2024;

  return (
    <div className="min-h-screen flex flex-col dark:bg-black transition-colors duration-300">
      <header className="bg-white dark:bg-black shadow-sm border-b border-transparent dark:border-amber-700/20">
        <div className="max-w-6xl mx-auto p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-amber-400 flex items-center gap-2">
            <div className="w-8 h-8 relative">
              <Image 
                src="/android-chrome-192x192.png" 
                alt="App Logo"
                fill
                className="object-cover"
              />
            </div>
            <span>YouTube Drive Uploader</span>
          </h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={() => signIn('google')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700 px-4 py-2 rounded-md transition-all duration-300 transform hover:scale-105 dark:border dark:border-amber-500/20"
            >
              <FaGoogle /> Sign In
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-amber-50 mb-4">
              Upload your Drive videos to YouTube with ease
            </h2>
            <p className="text-xl text-gray-600 dark:text-amber-200/70 mb-8">
              Easily convert and share your Google Drive videos as YouTube Shorts
            </p>
            <button
              onClick={() => signIn('google')}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-md text-lg font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg dark:border dark:border-amber-500/20"
            >
              <FaGoogle /> Get Started
            </button>
          </div>
        </section>

        <section className="py-16 px-4 bg-gray-50 dark:bg-black/40 border-y border-transparent dark:border-amber-800/20">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-amber-50 mb-12">
              How It Works
            </h2>
            <div className="relative mb-16">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {/* Step 1 */}
                <div className="bg-white dark:bg-black p-6 rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg relative z-10">
                  <div className="text-blue-600 dark:text-amber-400 text-4xl mb-4 flex justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-amber-600 text-white text-xs px-2 py-1 rounded-full">Step 1</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-amber-50 mb-2 text-center">
                    Get TikTok Data
                  </h3>
                  <p className="text-gray-600 dark:text-amber-200/70 text-center mb-3">
                    Get JSON data from <a href="https://apify.com" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">Apify.com</a> with TikTok "posts" results
                  </p>
                  
                  <button 
                    onClick={() => setShowJsonSample(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-colors text-sm"
                  >
                    <FaCode size={14} /> View Sample JSON Format
                  </button>
                </div>
                
                {/* Step 2 */}
                <div className="bg-white dark:bg-black p-6 rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg relative z-10">
                  <div className="text-blue-600 dark:text-amber-400 text-4xl mb-4 flex justify-center">
                    <FaFileVideo />
                  </div>
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-amber-600 text-white text-xs px-2 py-1 rounded-full">Step 2</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-amber-50 mb-2 text-center">
                    Download Videos
                  </h3>
                  <p className="text-gray-600 dark:text-amber-200/70 text-center mb-3">
                    Upload JSON file to batch download TikTok videos without watermarks using <a href="https://ssstiktok.io" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">ssstiktok.io</a>
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                    Downloads HD videos with no watermarks
                  </div>
                </div>
                
                {/* Step 3 */}
                <div className="bg-white dark:bg-black p-6 rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg relative z-10">
                  <div className="text-blue-600 dark:text-amber-400 text-4xl mb-4 flex justify-center">
                    <FaGoogle />
                  </div>
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-amber-600 text-white text-xs px-2 py-1 rounded-full">Step 3</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-amber-50 mb-2 text-center">
                    Save to Drive
                  </h3>
                  <p className="text-gray-600 dark:text-amber-200/70 text-center">
                    Videos are automatically saved to your Google Drive folders
                  </p>
                </div>
                
                {/* Step 4 */}
                <div className="bg-white dark:bg-black p-6 rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg relative z-10">
                  <div className="text-blue-600 dark:text-amber-400 text-4xl mb-4 flex justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-amber-600 text-white text-xs px-2 py-1 rounded-full">Step 4</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
                    Schedule Uploads
                  </h3>
                  <p className="text-gray-600 dark:text-amber-200/70 text-center">
                    Create smart scheduling for uploads over weeks or months
                  </p>
                </div>
                
                {/* Step 5 */}
                <div className="bg-white dark:bg-black p-6 rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg relative z-10">
                  <div className="text-blue-600 dark:text-amber-400 text-4xl mb-4 flex justify-center">
                    <FaYoutube />
                  </div>
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-amber-600 text-white text-xs px-2 py-1 rounded-full">Step 5</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-amber-50 mb-2 text-center">
                    YouTube Shorts
                  </h3>
                  <p className="text-gray-600 dark:text-amber-200/70 text-center">
                    Videos automatically upload to YouTube as Shorts
                  </p>
                </div>
                
                {/* Connection arrows */}
                <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-amber-500/30 -z-10 transform -translate-y-1/2"></div>
                
                {/* Circular arrows */}
                <div className="hidden md:block absolute -right-4 top-1/2 transform -translate-y-1/2 -translate-x-1/2 text-amber-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                
                <div className="hidden md:block absolute -left-4 top-1/2 transform -translate-y-1/2 translate-x-1/2 text-amber-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-gray-100 dark:bg-black border-t border-transparent dark:border-amber-800/20 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-center text-gray-500 dark:text-amber-200/50">
            &copy; {currentYear} YouTube Drive Uploader | Not affiliated with Google or YouTube
          </p>
        </div>
      </footer>

      {/* JSON Sample Dialog */}
      <JsonSampleDialog isOpen={showJsonSample} onClose={() => setShowJsonSample(false)} />

      {authError && (
        <AuthErrorBanner 
          message={typeof authError === 'object' ? authError.message : authError} 
          isNetworkError={typeof authError === 'object' && authError.isNetworkError}
          failureCount={typeof authError === 'object' && authError.failureCount}
          maxFailures={typeof authError === 'object' && authError.maxFailures}
          forceSignOut={typeof authError === 'object' && authError.forceSignOut}
          isAccessRevoked={typeof authError === 'object' && authError.isAccessRevoked}
        />
      )}
      
      {/* Display channel error if present */}
      {channelError && (
        <div className="fixed bottom-4 left-4 right-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-lg shadow-lg border border-red-200 dark:border-red-800/50 text-sm">
          <p className="font-medium">YouTube Channel Error: {channelError}</p>
        </div>
      )}
    </div>
  );
}
