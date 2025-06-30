'use client';

import React, { 
  Suspense, 
  ReactNode, 
  memo, 
  lazy, 
  useMemo, 
  useCallback,
  createContext,
  useContext,
  useState,
  useEffect,
  ComponentType
} from 'react';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { UserProvider } from '@/contexts/UserContext';
import { SecurityProvider } from '@/contexts/SecurityContext';
import { AccountProvider } from '@/contexts/AccountContext.tsx';
import { Toaster } from 'react-hot-toast';
import BrowserAlertBlocker from '@/components/BrowserAlertBlocker';
import ErrorBoundary from '@/components/ErrorBoundary';

// Type definitions for provider components
interface ProviderProps {
  children: ReactNode;
}

type ProviderComponent = React.FC<ProviderProps>;

// Fallback component for failed providers - prevents app crashes
const ProviderFallback = memo(({ children, providerName }: { 
  children: ReactNode; 
  providerName?: string; 
}) => {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Provider ${providerName} failed to load, using fallback`);
    }
  }, [providerName]);
  
  return <>{children}</>;
});

ProviderFallback.displayName = 'ProviderFallback';

// Enhanced lazy loading with retry mechanism and better error handling
const createLazyProvider = (
  importFn: () => Promise<any>,
  providerName: string,
  exportName?: string
) => {
  return lazy(async () => {
    let retries = 3;
    let lastError: Error = new Error('Initial error');

    while (retries > 0) {
      try {
        const module = await importFn();
        const Provider = exportName ? module[exportName] : module.default;
        
        if (!Provider) {
          throw new Error(`Provider ${providerName} not found in module`);
        }
        
        return { default: Provider as React.FC<ProviderProps> };
      } catch (error) {
        lastError = error as Error;
        retries--;
        
        if (retries > 0) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
        }
      }
    }

    // Final fallback after all retries failed
    console.error(`Failed to load ${providerName} after retries:`, lastError);
    
    // Create a proper React component with correct props interface
    const FallbackComponent: React.FC<ProviderProps> = ({ children }) => (
      <ProviderFallback providerName={providerName}>
        {children}
      </ProviderFallback>
    );
    
    FallbackComponent.displayName = `${providerName}Fallback`;
    
    return { default: FallbackComponent };
  });
};

// Helper function to create type-safe fallback components
const createFallbackProvider = (name: string): React.FC<ProviderProps> => {
  const FallbackComponent: React.FC<ProviderProps> = ({ children }) => <>{children}</>;
  FallbackComponent.displayName = `${name}Fallback`;
  return FallbackComponent;
};

// Safe lazy load providers with fallback for missing files
const MultiDriveProvider = createLazyProvider(
  () => import('@/contexts/MultiDriveContext.tsx').catch(() => ({
    MultiDriveProvider: createFallbackProvider('MultiDriveProvider')
  })),
  'MultiDriveProvider',
  'MultiDriveProvider'
);

const UploadProvider = createLazyProvider(
  () => import('@/contexts/UploadContext').catch(() => ({
    UploadProvider: createFallbackProvider('UploadProvider')
  })),
  'UploadProvider',
  'UploadProvider'
);

const UploadLogsProvider = createLazyProvider(
  () => import('@/contexts/UploadLogsContext').catch(() => ({
    UploadLogsProvider: createFallbackProvider('UploadLogsProvider')
  })),
  'UploadLogsProvider',
  'UploadLogsProvider'
);

const ScheduledUploadsProvider = createLazyProvider(
  () => import('@/contexts/ScheduledUploadsContext').catch(() => ({
    ScheduledUploadsProvider: createFallbackProvider('ScheduledUploadsProvider')
  })),
  'ScheduledUploadsProvider',
  'ScheduledUploadsProvider'
);

const TikTokProvider = createLazyProvider(
  () => import('@/contexts/TikTokContext').catch(() => ({
    TikTokProvider: createFallbackProvider('TikTokProvider')
  })),
  'TikTokProvider',
  'TikTokProvider'
);

const MultiChannelProvider = createLazyProvider(
  () => import('@/contexts/MultiChannelContext').catch(() => ({
    MultiChannelProvider: createFallbackProvider('MultiChannelProvider')
  })),
  'MultiChannelProvider',
  'MultiChannelProvider'
);

// Enhanced provider loading state with performance metrics
interface ProviderLoadingState {
  isLoading: boolean;
  loadedProviders: Set<string>;
  failedProviders: Set<string>;
  loadingTimes: Map<string, number>;
  totalLoadTime: number;
  markProviderLoaded: (provider: string) => void;
  markProviderFailed: (provider: string) => void;
  getProviderStatus: (provider: string) => 'loading' | 'loaded' | 'failed';
}

const ProviderLoadingContext = createContext<ProviderLoadingState | null>(null);

export const useProviderLoading = () => {
  const context = useContext(ProviderLoadingContext);
  if (!context) {
    throw new Error('useProviderLoading must be used within ProviderLoadingProvider');
  }
  return context;
};

// Enhanced provider loading state manager with performance tracking
const ProviderLoadingProvider = memo(({ children }: { children: ReactNode }) => {
  const [loadedProviders, setLoadedProviders] = useState<Set<string>>(new Set());
  const [failedProviders, setFailedProviders] = useState<Set<string>>(new Set());
  const [loadingTimes, setLoadingTimes] = useState<Map<string, number>>(new Map());
  const [startTimes] = useState<Map<string, number>>(new Map());

  const markProviderLoaded = useCallback((provider: string) => {
    const startTime = startTimes.get(provider);
    const loadTime = startTime ? Date.now() - startTime : 0;
    
    setLoadedProviders(prev => new Set([...prev, provider]));
    setLoadingTimes(prev => new Map([...prev, [provider, loadTime]]));
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Provider ${provider} loaded in ${loadTime}ms`);
    }
  }, [startTimes]);

  const markProviderFailed = useCallback((provider: string) => {
    const startTime = startTimes.get(provider);
    const loadTime = startTime ? Date.now() - startTime : 0;
    
    setFailedProviders(prev => new Set([...prev, provider]));
    setLoadingTimes(prev => new Map([...prev, [provider, loadTime]]));
    
    if (process.env.NODE_ENV === 'development') {
      console.warn(`❌ Provider ${provider} failed after ${loadTime}ms`);
    }
  }, [startTimes]);

  const getProviderStatus = useCallback((provider: string) => {
    if (loadedProviders.has(provider)) return 'loaded';
    if (failedProviders.has(provider)) return 'failed';
    return 'loading';
  }, [loadedProviders, failedProviders]);

  const isLoading = useMemo(() => {
    const totalProviders = 6; // Total number of lazy-loaded providers
    return loadedProviders.size + failedProviders.size < totalProviders;
  }, [loadedProviders.size, failedProviders.size]);

  const totalLoadTime = useMemo(() => {
    return Array.from(loadingTimes.values()).reduce((sum, time) => sum + time, 0);
  }, [loadingTimes]);

  // Initialize start times for providers
  useEffect(() => {
    const providers = [
      'MultiDriveProvider',
      'UploadProvider', 
      'UploadLogsProvider',
      'ScheduledUploadsProvider',
      'TikTokProvider',
      'MultiChannelProvider'
    ];
    
    providers.forEach(provider => {
      if (!startTimes.has(provider)) {
        startTimes.set(provider, Date.now());
      }
    });
  }, [startTimes]);

  const value = useMemo(() => ({
    isLoading,
    loadedProviders,
    failedProviders,
    loadingTimes,
    totalLoadTime,
    markProviderLoaded,
    markProviderFailed,
    getProviderStatus,
  }), [
    isLoading,
    loadedProviders,
    failedProviders,
    loadingTimes,
    totalLoadTime,
    markProviderLoaded,
    markProviderFailed,
    getProviderStatus,
  ]);

  return (
    <ProviderLoadingContext.Provider value={value}>
      {children}
    </ProviderLoadingContext.Provider>
  );
});

ProviderLoadingProvider.displayName = 'ProviderLoadingProvider';

interface ProvidersProps {
  children: ReactNode;
}

interface AuthProvidersProps {
  children: ReactNode;
}

interface CoreProvidersProps {
  children: ReactNode;
}

interface ContentProvidersProps {
  children: ReactNode;
}

// Enhanced loading fallback with progress indication
const LoadingFallback = memo(() => {
  const spinnerStyle = useMemo(() => ({
    background: 'conic-gradient(from 0deg, transparent, #3b82f6)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  }), []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div 
        className="h-12 w-12 rounded-full mb-4"
        style={spinnerStyle}
        aria-label="Loading application"
      />
      <div className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">
        Initializing application...
      </div>
    </div>
  );
});

LoadingFallback.displayName = 'LoadingFallback';

// Smart content loading fallback with provider status
const ContentLoadingFallback = memo(() => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-6">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Loading content providers{dots}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
        This may take a moment on first load
      </div>
    </div>
  );
});

ContentLoadingFallback.displayName = 'ContentLoadingFallback';

// Provider-specific loading fallback
const ProviderLoadingFallback = memo(({ providerName }: { providerName: string }) => (
  <div className="flex items-center justify-center p-2">
    <div className="w-4 h-4 border border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
    <span className="text-xs text-gray-500">Loading {providerName}...</span>
  </div>
));

ProviderLoadingFallback.displayName = 'ProviderLoadingFallback';

// Enhanced error boundary for providers with better error handling
const ProviderErrorBoundary = memo(({ 
  children, 
  fallback, 
  providerName 
}: { 
  children: ReactNode; 
  fallback?: ReactNode;
  providerName?: string;
}) => {
  const defaultFallback = useMemo(() => (
    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div className="text-red-800 dark:text-red-200 text-sm">
        Failed to load {providerName || 'provider'}. The app will continue to work with limited functionality.
      </div>
      {process.env.NODE_ENV === 'development' && (
        <div className="text-red-600 dark:text-red-300 text-xs mt-2">
          Check console for more details about this error.
        </div>
      )}
    </div>
  ), [providerName]);

  return (
    <ErrorBoundary fallback={fallback || defaultFallback}>
      {children}
    </ErrorBoundary>
  );
});

ProviderErrorBoundary.displayName = 'ProviderErrorBoundary';

// Main providers wrapper with enhanced error handling and loading states
export function Providers({ children }: ProvidersProps) {
  return (
    <ProviderLoadingProvider>
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <AuthProviders>
            <CoreProviders>
              <Suspense fallback={<ContentLoadingFallback />}>
                <ContentProviders>
                  {children}
                </ContentProviders>
              </Suspense>
            </CoreProviders>
          </AuthProviders>
        </Suspense>
      </ErrorBoundary>
    </ProviderLoadingProvider>
  );
}

// Authentication and theme providers with enhanced configuration
const AuthProviders = memo(({ children }: AuthProvidersProps) => {
  // Memoized session configuration for optimal performance
  const sessionConfig = useMemo(() => ({
    refetchInterval: 5 * 60, // 5 minutes - balanced between freshness and performance
    refetchOnWindowFocus: false, // Prevent unnecessary refetches on tab switching
    refetchWhenOffline: false as false, // Must be exactly 'false' for type
    basePath: '/api/auth', // Explicit base path for better routing
    keepAlive: 4 * 60, // Keep session alive for 4 minutes
  }), []);

  // Memoized toaster configuration with theme-aware styling
  const toasterConfig = useMemo(() => ({
    position: 'bottom-right' as const,
    reverseOrder: false,
    gutter: 8,
    containerClassName: 'toast-container',
    toastOptions: {
      duration: 4000,
      style: {
        background: 'var(--toast-bg)',
        color: 'var(--toast-color)',
        border: '1px solid var(--toast-border)',
        borderRadius: '8px',
        fontSize: '14px',
        maxWidth: '400px',
      },
      success: {
        iconTheme: {
          primary: 'var(--success-color)',
          secondary: 'var(--success-bg)',
        },
      },
      error: {
        iconTheme: {
          primary: 'var(--error-color)',
          secondary: 'var(--error-bg)',
        },
      },
    },
  }), []);

  return (
    <SessionProvider {...sessionConfig}>
      <ThemeProvider>
        <BrowserAlertBlocker />
        <Toaster {...toasterConfig} />
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
});

AuthProviders.displayName = 'AuthProviders';

// Core providers with enhanced error boundaries and loading states
const CoreProviders = ({ children }: CoreProvidersProps) => {
  const { markProviderLoaded, markProviderFailed } = useProviderLoading();

  // Mark critical providers as loaded immediately
  useEffect(() => {
    markProviderLoaded('ThemeProvider');
    markProviderLoaded('UserProvider');
    markProviderLoaded('SecurityProvider');
    markProviderLoaded('AccountProvider');
  }, [markProviderLoaded]);

  return (
    <ThemeProvider>
      <UserProvider>
        <SecurityProvider>
          <AccountProvider>
            <ProviderErrorBoundary providerName="MultiDriveProvider">
              <Suspense fallback={<ProviderLoadingFallback providerName="Drive Integration" />}>
                <MultiDriveProvider>
                  {children}
                </MultiDriveProvider>
              </Suspense>
            </ProviderErrorBoundary>
          </AccountProvider>
        </SecurityProvider>
      </UserProvider>
    </ThemeProvider>
  );
};

CoreProviders.displayName = 'CoreProviders';

// Content providers with intelligent loading and performance optimization
const ContentProviders = memo(({ children }: ContentProvidersProps) => {
  // Smart preloading strategy with error handling
  useEffect(() => {
    const preloadProviders = async () => {
      try {
        // Preload critical providers first with fallbacks
        const criticalProviders = [
          import('@/contexts/UploadContext').catch(() => null),
          import('@/contexts/UploadLogsContext').catch(() => null),
        ];

        // Preload secondary providers after a delay
        const secondaryProviders = [
          import('@/contexts/MultiChannelContext').catch(() => null),
          import('@/contexts/ScheduledUploadsContext').catch(() => null),
        ];

        // Load critical providers immediately
        const criticalResults = await Promise.allSettled(criticalProviders);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('Critical providers preload results:', criticalResults);
        }

        // Load secondary providers after a short delay
        setTimeout(async () => {
          const secondaryResults = await Promise.allSettled(secondaryProviders);
          
          if (process.env.NODE_ENV === 'development') {
            console.log('Secondary providers preload results:', secondaryResults);
          }
        }, 500);

        // Load TikTok provider last (least critical)
        setTimeout(async () => {
          const tikTokResult = await Promise.allSettled([
            import('@/contexts/TikTokContext').catch(() => null)
          ]);
          
          if (process.env.NODE_ENV === 'development') {
            console.log('TikTok provider preload result:', tikTokResult);
          }
        }, 1000);

      } catch (error) {
        console.warn('Failed to preload some providers:', error);
      }
    };

    // Start preloading after initial render
    const timer = setTimeout(preloadProviders, 100);
    return () => clearTimeout(timer);
  }, []); // Empty dependency array is correct here

  // Enhanced provider wrapper with loading tracking
  const ProviderWrapper = memo(({ 
    children, 
    providerName, 
    displayName 
  }: { 
    children: ReactNode; 
    providerName: string; 
    displayName: string; 
  }) => (
    <ProviderErrorBoundary 
      providerName={providerName}
      fallback={
        <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
          <div className="text-yellow-800 dark:text-yellow-200 text-xs">
            {displayName} is temporarily unavailable
          </div>
        </div>
      }
    >
      <Suspense 
        fallback={<ProviderLoadingFallback providerName={displayName} />}
      >
        {children}
      </Suspense>
    </ProviderErrorBoundary>
  ));

  ProviderWrapper.displayName = 'ProviderWrapper';

  return (
    <ProviderWrapper providerName="UploadProvider" displayName="Upload Manager">
      <UploadProvider>
        <ProviderWrapper providerName="UploadLogsProvider" displayName="Upload Logs">
          <UploadLogsProvider>
            <ProviderWrapper providerName="MultiChannelProvider" displayName="Multi-Channel">
              <MultiChannelProvider>
                <ProviderWrapper providerName="ScheduledUploadsProvider" displayName="Scheduler">
                  <ScheduledUploadsProvider>
                    <ProviderWrapper providerName="TikTokProvider" displayName="TikTok Integration">
                      <TikTokProvider>
                        {children}
                      </TikTokProvider>
                    </ProviderWrapper>
                  </ScheduledUploadsProvider>
                </ProviderWrapper>
              </MultiChannelProvider>
            </ProviderWrapper>
          </UploadLogsProvider>
        </ProviderWrapper>
      </UploadProvider>
    </ProviderWrapper>
  );
});

ContentProviders.displayName = 'ContentProviders';

// Export provider components and utilities for advanced usage
export {
  ProviderErrorBoundary,
  ProviderLoadingFallback,
  LoadingFallback,
  ContentLoadingFallback,
  ProviderFallback,
};

// Export types for external usage
export type { ProviderLoadingState, ProviderProps, ProviderComponent };

// Performance monitoring hook for development with error handling
export const useProviderPerformance = () => {
  const providerContext = useContext(ProviderLoadingContext);
  
  // Graceful fallback if used outside provider
  const fallbackData = useMemo(() => ({
    loadingTimes: new Map<string, number>(),
    totalLoadTime: 0,
    loadedProviders: new Set<string>(),
    failedProviders: new Set<string>(),
  }), []);

  const { 
    loadingTimes, 
    totalLoadTime, 
    loadedProviders, 
    failedProviders 
  } = providerContext || fallbackData;
  
  const getPerformanceReport = useCallback(() => {
    try {
      const loadingTimesArray = Array.from(loadingTimes.entries());
      
      const report = {
        totalProviders: loadedProviders.size + failedProviders.size,
        loadedCount: loadedProviders.size,
        failedCount: failedProviders.size,
        totalLoadTime,
        averageLoadTime: loadedProviders.size > 0 ? totalLoadTime / loadedProviders.size : 0,
        slowestProvider: loadingTimesArray.length > 0 
          ? loadingTimesArray.reduce(
              (slowest, [name, time]) => time > slowest.time ? { name, time } : slowest,
              { name: '', time: 0 }
            )
          : { name: 'None', time: 0 },
        fastestProvider: loadingTimesArray.length > 0
          ? loadingTimesArray.reduce(
              (fastest, [name, time]) => time < fastest.time ? { name, time } : fastest,
              { name: '', time: Infinity }
            )
          : { name: 'None', time: 0 },
      };
      
      // Fix fastest provider display
      if (report.fastestProvider.time === Infinity) {
        report.fastestProvider = { name: 'None', time: 0 };
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.group('🚀 Provider Performance Report');
        console.log('Total Providers:', report.totalProviders);
        console.log('Loaded Successfully:', report.loadedCount);
        console.log('Failed to Load:', report.failedCount);
        console.log('Total Load Time:', `${report.totalLoadTime}ms`);
        console.log('Average Load Time:', `${report.averageLoadTime.toFixed(2)}ms`);
        
        if (report.slowestProvider.name && report.slowestProvider.name !== 'None') {
          console.log('Slowest Provider:', `${report.slowestProvider.name} (${report.slowestProvider.time}ms)`);
        }
        
        if (report.fastestProvider.name && report.fastestProvider.name !== 'None') {
          console.log('Fastest Provider:', `${report.fastestProvider.name} (${report.fastestProvider.time}ms)`);
        }
        
        console.groupEnd();
      }
      
      return report;
    } catch (error) {
      console.error('Error generating performance report:', error);
      return {
        totalProviders: 0,
        loadedCount: 0,
        failedCount: 0,
        totalLoadTime: 0,
        averageLoadTime: 0,
        slowestProvider: { name: 'Error', time: 0 },
        fastestProvider: { name: 'Error', time: 0 },
      };
    }
  }, [loadingTimes, totalLoadTime, loadedProviders, failedProviders]);

  return {
    loadingTimes,
    totalLoadTime,
    loadedProviders,
    failedProviders,
    getPerformanceReport,
    isAvailable: !!providerContext,
  };
};
