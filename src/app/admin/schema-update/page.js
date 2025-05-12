'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { FaDatabase, FaSpinner, FaCheck, FaExclamationTriangle } from 'react-icons/fa';

export default function SchemaUpdatePage() {
  const { data: session, status } = useSession();
  const [isUpdating, setIsUpdating] = useState(false);
  const [result, setResult] = useState(null);
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const runSchemaUpdate = async () => {
    setIsUpdating(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/auth/schema-update', {
        headers: {
          'Authorization': `Bearer admin-token`
        }
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        message: 'Error updating schema',
        error: error.message
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
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
  
  // Authentication check
  if (status === 'loading') {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-blue-500 mx-auto mb-4" size={36} />
          <p className="text-gray-600 dark:text-gray-400">Checking authentication...</p>
        </div>
      </div>
    );
  }
  
  if (status === 'unauthenticated') {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <div className="text-center p-8 bg-red-50 border border-red-200 rounded-lg max-w-md">
          <FaExclamationTriangle className="text-red-500 mx-auto mb-4" size={36} />
          <h1 className="text-2xl font-bold text-red-700 mb-2">Authentication Required</h1>
          <p className="text-gray-700 mb-4">You need to be signed in to access this page.</p>
          <a 
            href="/"
            className="px-4 py-2 bg-blue-600 text-white rounded-md inline-block hover:bg-blue-700"
          >
            Go to Sign In
          </a>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <FaDatabase className="text-blue-500" size={24} />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Database Schema Update</h1>
        </div>
        
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          This tool will update your database schema to add any missing columns required by the application.
        </p>
        
        <div className="mb-6">
          <button
            onClick={runSchemaUpdate}
            disabled={isUpdating}
            className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? (
              <>
                <FaSpinner className="animate-spin" />
                Updating Schema...
              </>
            ) : (
              <>
                <FaDatabase />
                Update Schema
              </>
            )}
          </button>
        </div>
        
        {result && (
          <div className={`p-4 rounded-md ${result.success ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800/30' : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800/30'}`}>
            <div className="flex items-start gap-3">
              {result.success ? (
                <FaCheck className="text-green-500 mt-1" />
              ) : (
                <FaExclamationTriangle className="text-red-500 mt-1" />
              )}
              <div>
                <h3 className={`font-medium ${result.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {result.message}
                </h3>
                {result.error && (
                  <p className="text-red-600 dark:text-red-400 mt-2 text-sm font-mono">
                    {result.error}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            What this does
          </h2>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-2">
            <li>Adds `is_valid` column to user_tokens table</li>
            <li>Adds `last_network_error` column to user_tokens table</li>
            <li>Adds `error_message` column to user_tokens table</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 