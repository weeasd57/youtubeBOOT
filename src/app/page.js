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
    className="min-h-screen p-8 flex items-center justify-center bg-slate-50 dark:bg-slate-900" 
    role="status" 
    aria-label="Loading application"
  >
    <div className="text-center">
      <div 
        className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"
        aria-hidden="true"
      />
      <p className="text-slate-600 dark:text-slate-400 text-sm">Loading Content Scheduler...</p>
    </div>
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-20 px-4 bg-gradient-to-br from-blue-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
          <div className="max-w-5xl mx-auto text-center">
            <div className="mb-8 flex justify-center">
              <div className="w-16 h-16 relative">
                <Image 
                  src="/android-chrome-192x192.png" 
                  alt="Uploader"
                  width={64}
                  height={64}
                  className="rounded-2xl shadow-schedule"
                  priority
                />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-slate-50 mb-4 tracking-tight">
              Content Scheduler
            </h1>
            <h2 className="text-xl md:text-2xl font-medium text-slate-600 dark:text-slate-300 mb-6">
              Smart scheduling for your YouTube content
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Manage multiple accounts, schedule uploads, and streamline your content workflow with our intelligent scheduling system
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleSignIn}
                disabled={status === 'loading'}
                className="schedule-button-primary text-lg px-8 py-3 inline-flex items-center gap-3 shadow-schedule-lg"
                aria-label="Sign in with Google to get started"
              >
                <FaGoogle className="text-lg" aria-hidden="true" /> 
                {status === 'loading' ? 'Starting...' : 'Start Scheduling'}
              </button>
              <a
                href="#features"
                className="schedule-button-secondary text-lg px-8 py-3 inline-flex items-center gap-3"
                aria-label="Learn more about our features"
              >
                Learn More
              </a>
            </div>
          </div>
        </section>

        {/* Key Features Section */}
        <section id="features" className="py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4">
                Everything you need to schedule content
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Powerful features designed to make content scheduling simple and efficient
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 - Multiple Accounts */}
              <div className="schedule-card animate-fade-in">
                <div className="schedule-card-content text-center">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <FaUserFriends className="text-blue-600 dark:text-blue-400 text-xl" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-3">
                    Multi-Account Management
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Connect and manage multiple Google accounts and YouTube channels from a unified dashboard
                  </p>
                </div>
              </div>
              
              {/* Feature 2 - Cross-Account Uploads */}
              <div className="schedule-card animate-fade-in" style={{animationDelay: '0.1s'}}>
                <div className="schedule-card-content text-center">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <FaExchangeAlt className="text-green-600 dark:text-green-400 text-xl" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-3">
                    Cross-Platform Uploads
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Upload videos from any connected Google Drive to any connected YouTube channel seamlessly
                  </p>
                </div>
              </div>
              
              {/* Feature 3 - Unified Scheduler */}
              <div className="schedule-card animate-fade-in" style={{animationDelay: '0.2s'}}>
                <div className="schedule-card-content text-center">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <FaCalendarAlt className="text-purple-600 dark:text-purple-400 text-xl" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-3">
                    Smart Scheduling
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Schedule all your uploads with intelligent timing and automated publishing features
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 px-4 bg-slate-100 dark:bg-slate-800/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4">
                Simple workflow, powerful results
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Get started in minutes with our streamlined scheduling process
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Step 1 */}
              <div className="text-center animate-slide-up">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-schedule-lg">
                  <FaUserFriends className="text-white text-2xl" />
                </div>
                <div className="schedule-badge schedule-badge-info mb-3">Step 1</div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
                  Connect Accounts
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Link your Google Drive and YouTube accounts securely
                </p>
              </div>
              
              {/* Step 2 */}
              <div className="text-center animate-slide-up" style={{animationDelay: '0.1s'}}>
                <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-schedule-lg">
                  <FaFileVideo className="text-white text-2xl" />
                </div>
                <div className="schedule-badge schedule-badge-success mb-3">Step 2</div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
                  Browse Content
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Access videos from all connected Drive accounts
                </p>
              </div>
              
              {/* Step 3 */}
              <div className="text-center animate-slide-up" style={{animationDelay: '0.2s'}}>
                <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-schedule-lg">
                  <FaCalendarAlt className="text-white text-2xl" />
                </div>
                <div className="schedule-badge schedule-badge-warning mb-3">Step 3</div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
                  Create Schedule
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Set up intelligent scheduling for your content
                </p>
              </div>
              
              {/* Step 4 */}
              <div className="text-center animate-slide-up" style={{animationDelay: '0.3s'}}>
                <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-schedule-lg">
                  <FaCloudUploadAlt className="text-white text-2xl" />
                </div>
                <div className="schedule-badge schedule-badge-success mb-3">Step 4</div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
                  Auto-Publish
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Let the system handle uploads automatically
                </p>
              </div>
            </div>
            
            {/* Connection line for desktop */}
            <div className="hidden lg:block relative mt-8">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-3/4 h-0.5 bg-gradient-to-r from-blue-600 via-green-600 via-purple-600 to-orange-600 opacity-30"></div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-20 px-4 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to streamline your content?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Join thousands of creators who trust our platform to manage their content scheduling
            </p>
            <button
              onClick={handleSignIn}
              disabled={status === 'loading'}
              className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-3 rounded-lg text-lg font-medium transition-colors duration-200 inline-flex items-center gap-3 shadow-schedule-lg"
              aria-label="Start using Content Scheduler for free with Google sign-in"
            >
              <FaGoogle className="text-lg" aria-hidden="true" /> 
              {status === 'loading' ? 'Starting...' : 'Start Free Today'}
            </button>
          </div>
        </section>
      </main>

      <footer className="py-12 px-4 bg-slate-900 text-slate-300">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-6 md:mb-0">
              <div className="w-8 h-8 relative mr-3">
                <Image 
                  src="/android-chrome-192x192.png" 
                  alt="Content Scheduler"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
              </div>
              <span className="text-slate-100 font-semibold text-lg">Content Scheduler</span>
            </div>
            
            <div className="flex flex-wrap gap-6 justify-center items-center mb-6 md:mb-0">
              <Link href="/terms" className="text-slate-400 hover:text-slate-200 text-sm transition-colors">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-slate-400 hover:text-slate-200 text-sm transition-colors">
                Privacy Policy
              </Link>
              <ThemeToggle />
            </div>
            
            <div className="text-slate-400 text-sm">
              &copy; {currentYear} Content Scheduler
            </div>
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