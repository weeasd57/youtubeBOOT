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
import { AccountProvider } from '@/contexts/AccountContext';
import { MultiChannelProvider } from '@/contexts/MultiChannelContext';
import { MultiDriveProvider } from '@/contexts/MultiDriveContext';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import BrowserAlertBlocker from '@/components/BrowserAlertBlocker';

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
        <AccountProvider>
          {!mounted ? (
            // During initial render, just show a loading state
            <div className="opacity-0">{children}</div>
          ) : (
            // Once mounted on client, use all providers
            <UserProvider>
              <DriveProvider>
                <MultiDriveProvider>
                  <BrowserAlertBlocker />
                  <ContentProviders>
                    {children}
                  </ContentProviders>
                </MultiDriveProvider>
              </DriveProvider>
            </UserProvider>
          )}
        </AccountProvider>
      </ThemeProvider>
      <Toaster position="bottom-right" />
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
            <MultiChannelProvider>
              <ScheduledUploadsProvider>
                <TikTokProvider>
                  {children}
                </TikTokProvider>
              </ScheduledUploadsProvider>
            </MultiChannelProvider>
          </YouTubeChannelProvider>
        </YouTubeProvider>
      </UploadLogsProvider>
    </UploadProvider>
  );
}