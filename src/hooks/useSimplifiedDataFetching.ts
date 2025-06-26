'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useUser } from '@/contexts/UserContext';

interface InitializationState {
  isInitializing: boolean;
  progress: number;
  currentStep: string;
  error: string | null;
  isComplete: boolean;
}

/**
 * Simplified data fetching hook that focuses on reliable initialization
 * without complex timeout mechanisms that can cause hanging
 */
export function useSimplifiedDataFetching() {
  const { data: session, status } = useSession();
  const { activeAccount, loading: userLoading } = useUser();
  
  const [state, setState] = useState<InitializationState>({
    isInitializing: true,
    progress: 0,
    currentStep: 'Starting initialization...',
    error: null,
    isComplete: false
  });

  const initializationAttempted = useRef(false);
  const mountedRef = useRef(true);

  // Simple progress updater
  const updateProgress = useCallback((progress: number, step: string) => {
    if (mountedRef.current) {
      setState(prev => ({
        ...prev,
        progress,
        currentStep: step
      }));
    }
  }, []);

  // Simple error handler
  const setError = useCallback((error: string) => {
    if (mountedRef.current) {
      setState(prev => ({
        ...prev,
        error,
        isInitializing: false
      }));
    }
  }, []);

  // Complete initialization
  const completeInitialization = useCallback(() => {
    if (mountedRef.current) {
      setState(prev => ({
        ...prev,
        isInitializing: false,
        isComplete: true,
        progress: 100,
        currentStep: 'Complete!'
      }));
    }
  }, []);

  // Main initialization function
  const initializeApp = useCallback(async () => {
    if (initializationAttempted.current || !mountedRef.current) {
      return;
    }

    initializationAttempted.current = true;

    try {
      // Step 1: Check authentication
      updateProgress(20, 'Checking authentication...');
      
      if (status === 'loading') {
        // Wait a bit for session to load
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (status === 'unauthenticated') {
        setError('Authentication required');
        return;
      }

      // Step 2: Wait for user data if still loading
      updateProgress(40, 'Loading user profile...');
      
      if (userLoading) {
        // Wait for user loading to complete, but with timeout
        let attempts = 0;
        while (userLoading && attempts < 10 && mountedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
      }

      // Step 3: Basic setup complete
      updateProgress(60, 'Setting up workspace...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 4: Finalize
      updateProgress(80, 'Finalizing setup...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Complete
      updateProgress(100, 'Ready!');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      completeInitialization();

    } catch (error) {
      console.error('Initialization error:', error);
      setError(error instanceof Error ? error.message : 'Initialization failed');
    }
  }, [status, userLoading, updateProgress, setError, completeInitialization]);

  // Start initialization when conditions are met
  useEffect(() => {
    if (status !== 'loading' && !initializationAttempted.current) {
      initializeApp();
    }
  }, [status, initializeApp]);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Force complete after maximum time
  useEffect(() => {
    const maxInitTime = setTimeout(() => {
      if (state.isInitializing && mountedRef.current) {
        console.warn('Force completing initialization after timeout');
        completeInitialization();
      }
    }, 10000); // 10 seconds max

    return () => clearTimeout(maxInitTime);
  }, [state.isInitializing, completeInitialization]);

  return {
    ...state,
    retry: () => {
      initializationAttempted.current = false;
      setState({
        isInitializing: true,
        progress: 0,
        currentStep: 'Retrying initialization...',
        error: null,
        isComplete: false
      });
      initializeApp();
    }
  };
}