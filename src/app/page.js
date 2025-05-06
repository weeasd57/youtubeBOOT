'use client';

import { useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { FaGoogle, FaYoutube, FaFileVideo } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import ClientOnly from '@/components/ClientOnly';
import ThemeToggle from '@/components/ThemeToggle';

export default function LandingPage() {
  const { data: session, status } = useSession();
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
      <div className="min-h-screen p-8 flex items-center justify-center dark:bg-gray-900" suppressHydrationWarning>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" suppressHydrationWarning></div>
      </div>
    );
  }

  // Using static year to avoid hydration issues with Date functions
  const currentYear = 2024;

  return (
    <div className="min-h-screen flex flex-col dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <FaYoutube className="text-red-600" />
            <span>YouTube Drive Uploader</span>
          </h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={() => signIn('google')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800 px-4 py-2 rounded-md transition-colors"
            >
              <FaGoogle /> Sign In
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Upload your Drive videos to YouTube with ease
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Easily convert and share your Google Drive videos as YouTube Shorts
            </p>
            <button
              onClick={() => signIn('google')}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-md text-lg font-medium transition-colors"
            >
              <FaGoogle /> Get Started
            </button>
          </div>
        </section>

        <section className="py-16 px-4 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
              How It Works
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md">
                <div className="text-blue-600 dark:text-blue-400 text-4xl mb-4 flex justify-center">
                  <FaGoogle />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
                  Connect Your Accounts
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-center">
                  Sign in with your Google account to access your Drive and YouTube
                </p>
              </div>
              <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md">
                <div className="text-blue-600 dark:text-blue-400 text-4xl mb-4 flex justify-center">
                  <FaFileVideo />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
                  Select Your Videos
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-center">
                  Browse and select videos from your Google Drive
                </p>
              </div>
              <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md">
                <div className="text-blue-600 dark:text-blue-400 text-4xl mb-4 flex justify-center">
                  <FaYoutube />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
                  Upload to YouTube
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-center">
                  Upload directly to YouTube as Shorts with custom titles and descriptions
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
              Ready to Simplify Your Video Workflow?
            </h2>
            <button
              onClick={() => signIn('google')}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md text-lg font-medium transition-colors"
            >
              <FaGoogle /> Sign In with Google
            </button>
          </div>
        </section>
      </main>

      <footer className="bg-gray-100 dark:bg-gray-800 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-center text-gray-500 dark:text-gray-400">
            &copy; {currentYear} YouTube Drive Uploader | Not affiliated with Google or YouTube
          </p>
        </div>
      </footer>
    </div>
  );
}
