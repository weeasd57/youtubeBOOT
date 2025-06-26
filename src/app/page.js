'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { FaGoogle, FaUserFriends, FaExchangeAlt, FaCalendarAlt, FaArrowsAlt, FaCloudUploadAlt, FaFileVideo } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import AuthErrorBanner from '@/components/AuthErrorBanner';
import JsonSampleDialog from '@/components/JsonSampleDialog';
import Image from "next/image";
import { useMultiChannel } from '@/contexts/MultiChannelContext';
import { useUser } from '@/contexts/UserContext';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

// Loading component with better accessibility
const LoadingSpinner = () => (
  <div 
    className="min-h-screen p-8 flex items-center justify-center dark:bg-black" 
    role="status" 
    aria-label="Loading application"
  >
    <div 
      className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-amber-500"
      aria-hidden="true"
    />
    <span className="sr-only">Loading...</span>
  </div>
);

export default function LandingPage() {
  // Handle client-side mounting to prevent hydration issues
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Don't render anything on the server or during initial mount
  if (!isMounted) {
    return <LoadingSpinner />;
  }
  
  // Render client-side content
  return <LandingPageContent />;
}

// Client-only component with full functionality
function LandingPageContent() {
  const { data: session, status, error: authError } = useSession();
  const router = useRouter();
  const [showJsonSample, setShowJsonSample] = useState(false);
  const { user, loading: userLoading } = useUser();
  const { refreshAllChannels, errors: channelErrors } = useMultiChannel();

  // Memoized current year to avoid hydration issues
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  // Secure sign-in handler with error handling
  const handleSignIn = useCallback(async () => {
    try {
      const result = await signIn('google', { 
        callbackUrl: '/home',
        redirect: false 
      });
      
      if (result?.error) {
        toast.error('Sign in failed. Please try again.');
        console.error('Sign in error:', result.error);
      }
    } catch (error) {
      toast.error('An unexpected error occurred during sign in.');
      console.error('Sign in error:', error);
    }
  }, []);

  // Redirect to home page if authenticated
  useEffect(() => {
    if (status === 'authenticated' && session) {
      router.push('/home');
    }
  }, [status, session, router]);

  // Show loading spinner while checking authentication
  if (status === 'loading' || userLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen flex flex-col dark:bg-black transition-colors duration-300">
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-16 px-4 bg-gradient-to-b from-amber-50 to-white dark:from-black dark:to-amber-950/20 border-b border-amber-100 dark:border-amber-900/20">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 relative">
                <Image 
                  src="/android-chrome-192x192.png" 
                  alt="Uploader"
                  width={80}
                  height={80}
                  className="rounded-lg shadow-lg"
                  priority
                />
              </div>
            </div>
            <h1 className="text-5xl font-bold text-gray-900 dark:text-amber-50 mb-4">
              Uploader
            </h1>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-amber-100 mb-4">
              Manage Multiple Accounts, One Dashboard
            </h2>
            <p className="text-xl text-gray-600 dark:text-amber-200/70 mb-8">
              Seamlessly upload videos from multiple Google Drive accounts to multiple YouTube channels with a unified scheduler
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={handleSignIn}
                disabled={status === 'loading'}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-md text-lg font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg dark:border dark:border-amber-500/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                aria-label="Sign in with Google to get started"
              >
                <FaGoogle aria-hidden="true" /> 
                {status === 'loading' ? 'Signing in...' : 'Get Started'}
              </button>
              <a
                href="#features"
                className="inline-flex items-center gap-2 bg-transparent border-2 border-amber-500 text-amber-600 dark:text-amber-400 px-6 py-3 rounded-md text-lg font-medium transition-all duration-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                aria-label="Learn more about our features"
              >
                Learn More
              </a>
            </div>
          </div>
        </section>

        {/* Key Features Section */}
        <section id="features" className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-amber-50 mb-12">
              Key Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 - Multiple Accounts */}
              <div className="bg-white dark:bg-black p-6 rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="text-amber-500 text-4xl mb-4 flex justify-center">
                  <FaUserFriends />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-amber-50 mb-2 text-center">
                  Multiple Accounts
                </h3>
                <p className="text-gray-600 dark:text-amber-200/70 text-center">
                  Connect and manage multiple Google accounts and YouTube channels from a single dashboard
                </p>
              </div>
              
              {/* Feature 2 - Cross-Account Uploads */}
              <div className="bg-white dark:bg-black p-6 rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="text-amber-500 text-4xl mb-4 flex justify-center">
                  <FaExchangeAlt />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-amber-50 mb-2 text-center">
                  Cross-Account Uploads
                </h3>
                <p className="text-gray-600 dark:text-amber-200/70 text-center">
                  Upload videos from any connected Google Drive to any connected YouTube channel
                </p>
              </div>
              
              {/* Feature 3 - Unified Scheduler */}
              <div className="bg-white dark:bg-black p-6 rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="text-amber-500 text-4xl mb-4 flex justify-center">
                  <FaCalendarAlt />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-amber-50 mb-2 text-center">
                  Unified Scheduler
                </h3>
                <p className="text-gray-600 dark:text-amber-200/70 text-center">
                  Schedule all your uploads from one table view with smart scheduling features
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
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
                    <FaUserFriends />
                  </div>
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-amber-600 text-white text-xs px-2 py-1 rounded-full">Step 1</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-amber-50 mb-2 text-center">
                    Connect Accounts
                  </h3>
                  <p className="text-gray-600 dark:text-amber-200/70 text-center mb-3">
                    Add multiple Google Drive and YouTube accounts to your dashboard
                  </p>
                </div>
                
                {/* Step 2 */}
                <div className="bg-white dark:bg-black p-6 rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg relative z-10">
                  <div className="text-blue-600 dark:text-amber-400 text-4xl mb-4 flex justify-center">
                    <FaFileVideo />
                  </div>
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-amber-600 text-white text-xs px-2 py-1 rounded-full">Step 2</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-amber-50 mb-2 text-center">
                    Access Videos
                  </h3>
                  <p className="text-gray-600 dark:text-amber-200/70 text-center mb-3">
                    Browse videos from all your connected Google Drive accounts
                  </p>
                </div>
                
                {/* Step 3 */}
                <div className="bg-white dark:bg-black p-6 rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg relative z-10">
                  <div className="text-blue-600 dark:text-amber-400 text-4xl mb-4 flex justify-center">
                    <FaArrowsAlt />
                  </div>
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-amber-600 text-white text-xs px-2 py-1 rounded-full">Step 3</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-amber-50 mb-2 text-center">
                    Mix & Match
                  </h3>
                  <p className="text-gray-600 dark:text-amber-200/70 text-center">
                    Select videos from any Drive account for any YouTube channel
                  </p>
                </div>
                
                {/* Step 4 */}
                <div className="bg-white dark:bg-black p-6 rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg relative z-10">
                  <div className="text-blue-600 dark:text-amber-400 text-4xl mb-4 flex justify-center">
                    <FaCalendarAlt />
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
                    <FaCloudUploadAlt />
                  </div>
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-amber-600 text-white text-xs px-2 py-1 rounded-full">Step 5</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-amber-50 mb-2 text-center">
                    Automated Uploads
                  </h3>
                  <p className="text-gray-600 dark:text-amber-200/70 text-center">
                    Let the system automatically upload your videos according to schedule
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

        {/* Call to Action */}
        <section className="py-16 px-4 bg-amber-50 dark:bg-amber-900/10 border-t border-amber-100 dark:border-amber-900/20">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-amber-50 mb-4">
              Ready to Streamline Your Workflow?
            </h2>
            <p className="text-xl text-gray-600 dark:text-amber-200/70 mb-8">
              Manage multiple accounts, schedule uploads, and grow your online presence with ease
            </p>
            <button
              onClick={handleSignIn}
              disabled={status === 'loading'}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-md text-lg font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg dark:border dark:border-amber-500/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              aria-label="Start using Uploader for free with Google sign-in"
            >
              <FaGoogle aria-hidden="true" /> 
              {status === 'loading' ? 'Starting...' : 'Start Now - It\'s Free'}
            </button>
          </div>
        </section>
      </main>

      <footer className="py-8 px-4 bg-gray-50 dark:bg-black border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <div className="w-10 h-10 relative mr-3">
              <Image 
                src="/android-chrome-192x192.png" 
                alt="Uploader"
                width={40}
                height={40}
                className="rounded-md"
              />
            </div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">Uploader</span>
          </div>
          
          <div className="flex flex-wrap gap-4 justify-center items-center">
            <Link href="/terms" className="text-gray-600 dark:text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 text-sm">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 text-sm">
              Privacy Policy
            </Link>
            <ThemeToggle />
          </div>
          
          <div className="text-gray-500 dark:text-gray-400 text-sm mt-4 md:mt-0">
            &copy; {currentYear} YouTube Boot
          </div>
        </div>
      </footer>
      
      {/* JSON Sample Dialog */}
      {showJsonSample && (
        <JsonSampleDialog onClose={() => setShowJsonSample(false)} />
      )}
      
      {/* Auth Error Banner */}
      {authError && <AuthErrorBanner error={authError} />}
    </div>
  );
}