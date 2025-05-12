'use client';

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { FaGoogle, FaYoutube, FaFileVideo } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import ClientOnly from '@/components/ClientOnly';
import ThemeToggle from '@/components/ThemeToggle';
import AuthErrorBanner from '@/components/AuthErrorBanner';

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
  const { data: session, status, error } = useSession();
  const router = useRouter();

  // Redirect to home page if authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/home');
    }
  }, [status, router]);

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
            <FaYoutube className="text-red-600" />
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
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white dark:bg-black p-6 rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="text-blue-600 dark:text-amber-400 text-4xl mb-4 flex justify-center">
                  <FaGoogle />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-amber-50 mb-2 text-center">
                  Connect Your Accounts
                </h3>
                <p className="text-gray-600 dark:text-amber-200/70 text-center">
                  Sign in with your Google account to access your Drive and YouTube
                </p>
              </div>
              <div className="bg-white dark:bg-black p-6 rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="text-blue-600 dark:text-amber-400 text-4xl mb-4 flex justify-center">
                  <FaFileVideo />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-amber-50 mb-2 text-center">
                  Select Your Videos
                </h3>
                <p className="text-gray-600 dark:text-amber-200/70 text-center">
                  Browse and select videos from your Google Drive
                </p>
              </div>
              <div className="bg-white dark:bg-black p-6 rounded-lg shadow-md border dark:border-amber-700/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="text-blue-600 dark:text-amber-400 text-4xl mb-4 flex justify-center">
                  <FaYoutube />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-amber-50 mb-2 text-center">
                  Upload to YouTube
                </h3>
                <p className="text-gray-600 dark:text-amber-200/70 text-center">
                  Upload directly to YouTube as Shorts with custom titles and descriptions
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-amber-50 mb-8">
              Ready to Simplify Your Video Workflow?
            </h2>
            <button
              onClick={() => signIn('google')}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700 px-6 py-3 rounded-md text-lg font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg dark:border dark:border-amber-500/20"
            >
              <FaGoogle /> Sign In with Google
            </button>
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

      {error && (
        <AuthErrorBanner 
          message={typeof error === 'object' ? error.message : error} 
          isNetworkError={typeof error === 'object' && error.isNetworkError}
          failureCount={typeof error === 'object' && error.failureCount}
          maxFailures={typeof error === 'object' && error.maxFailures}
          forceSignOut={typeof error === 'object' && error.forceSignOut}
          isAccessRevoked={typeof error === 'object' && error.isAccessRevoked}
        />
      )}
    </div>
  );
}
