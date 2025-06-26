'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useSimplifiedDataFetching } from '@/hooks/useSimplifiedDataFetching';
import Image from 'next/image';

interface DashboardInitializerProps {
  children: React.ReactNode;
}

export default function DashboardInitializer({ children }: DashboardInitializerProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isInitializing, progress, currentStep, error, isComplete, retry } = useSimplifiedDataFetching();

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Show loading screen during initialization
  if (isInitializing && status !== 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            {/* App Logo */}
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <Image 
                src="/android-chrome-192x192.png" 
                alt="App Logo"
                fill
                className="object-cover rounded-full"
                priority
              />
            </div>
            
            {/* Loading Spinner */}
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
              Setting up your dashboard
            </h2>
            <p className="text-gray-600 dark:text-gray-400">{currentStep}</p>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4">
            <div 
              className="bg-blue-600 dark:bg-blue-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            {progress}% Complete
          </div>
        </div>
      </div>
    );
  }

  // Show error screen if initialization failed
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 dark:from-red-900 dark:to-pink-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            {/* Error Icon */}
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
              Setup Failed
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            
            <div className="space-y-3">
              <button
                onClick={retry}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition-colors font-medium"
              >
                Try Again
              </button>
              
              <button
                onClick={() => router.push('/')}
                className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-3 px-4 rounded-lg transition-colors font-medium"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show children when initialization is complete
  return <>{children}</>;
}