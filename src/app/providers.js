'use client';

import { SessionProvider } from 'next-auth/react';
import { UserProvider } from '@/contexts/UserContext';
import { DriveProvider } from '@/contexts/DriveContext';
import { UploadProvider } from '@/contexts/UploadContext';
import { UploadLogsProvider } from '@/contexts/UploadLogsContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { YouTubeProvider } from '@/contexts/YouTubeContext';
import { YouTubeChannelProvider } from '@/contexts/YouTubeChannelContext';
import { ScheduledUploadsProvider } from '@/contexts/ScheduledUploadsContext';
import { TikTokProvider } from '@/contexts/TikTokContext';
import { useState, useEffect } from 'react';

// Simplified providers structure
export function Providers({ children }) {
  // Use client-side only mounting to prevent hydration issues
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Always include SessionProvider, even during server-side rendering
  return (
    <SessionProvider>
      <ThemeProvider>
        {!mounted ? (
          // During initial render, just show a loading state
          <div className="opacity-0">{children}</div>
        ) : (
          // Once mounted on client, use all providers
          <UserProvider>
            <DriveProvider>
              <ContentProviders>
                {children}
              </ContentProviders>
            </DriveProvider>
          </UserProvider>
        )}
      </ThemeProvider>
    </SessionProvider>
  );
}

// Split into two provider groups to reduce complexity
function ContentProviders({ children }) {
  return (
    <UploadProvider>
      <UploadLogsProvider>
        <YouTubeProvider>
          <YouTubeChannelProvider>
            <ScheduledUploadsProvider>
              <TikTokProvider>
                {children}
              </TikTokProvider>
            </ScheduledUploadsProvider>
          </YouTubeChannelProvider>
        </YouTubeProvider>
      </UploadLogsProvider>
    </UploadProvider>
  );
}