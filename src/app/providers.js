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

export function Providers({ children }) {
  return (
    <ThemeProvider>
      <SessionProvider suppressHydrationWarning>
        <UserProvider>
          <DriveProvider>
            <UploadProvider>
              <UploadLogsProvider>
                <YouTubeProvider>
                  <YouTubeChannelProvider>
                    <ScheduledUploadsProvider>
                      {children}
                    </ScheduledUploadsProvider>
                  </YouTubeChannelProvider>
                </YouTubeProvider>
              </UploadLogsProvider>
            </UploadProvider>
          </DriveProvider>
        </UserProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}