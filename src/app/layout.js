import "./globals.css";
import { Providers } from "./providers";
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/ui/toast';
import { ToastInitializer } from '@/components/ToastHelper';
import FooterWrapper from '@/components/FooterWrapper';
import NavbarWrapper from '@/components/NavbarWrapper';
import DialogBlockerWrapper from '@/components/DialogBlockerWrapper';
import DevelopmentHelper from '@/components/DevelopmentHelper';
import PerformanceMonitor from '@/components/PerformanceMonitor';
import { ThemeProvider } from '@/context/ThemeContext';

// Optimized font loading with preload
const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
  fallback: ['system-ui', 'arial'],
});

// Enhanced metadata with security headers
export const metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  title: {
    default: "Content Scheduler - Smart Social Media Management",
    template: "%s | Content Scheduler"
  },
  description: "The smarter way to manage your social media content. Connect multiple accounts, schedule posts, and grow your audience effortlessly.",
  keywords: ["content scheduler", "social media management", "YouTube scheduler", "Google Drive", "multi-account", "Buffer alternative"],
  authors: [{ name: "Content Scheduler Team" }],
  creator: "Content Scheduler",
  publisher: "Content Scheduler",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
    other: [
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
    ]
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    siteName: 'Content Scheduler',
    title: 'Content Scheduler - Smart Social Media Management',
    description: 'The smarter way to manage your social media content. Connect multiple accounts, schedule posts, and grow your audience effortlessly.',
    images: [
      {
        url: '/android-chrome-512x512.png',
        width: 512,
        height: 512,
        alt: 'Content Scheduler Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Content Scheduler - Smart Social Media Management',
    description: 'The smarter way to manage your social media content.',
    images: ['/android-chrome-512x512.png'],
  },
};

// Security headers
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3b82f6' },
    { media: '(prefers-color-scheme: dark)', color: '#1e40af' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html 
      lang="en" 
      className={`scroll-smooth ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Performance hints */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googleapis.com" />
        <link rel="dns-prefetch" href="https://accounts.google.com" />
        
        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#3b82f6" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1e40af" media="(prefers-color-scheme: dark)" />
      </head>
      <body
        className={`font-sans antialiased dark ${inter.className}`}
        suppressHydrationWarning
      >
        {/* Noscript fallback */}
        <noscript>
          <div className="bg-red-600 text-white p-4 text-center">
            This application requires JavaScript to function properly. Please enable JavaScript in your browser.
          </div>
        </noscript>

        <ThemeProvider>
          <ToastProvider>
            <ToastInitializer />
            <DevelopmentHelper />
            <PerformanceMonitor />
            <Providers>
              {children}
            </Providers>
          </ToastProvider>
        </ThemeProvider>

        {/* Skip to main content for accessibility */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50"
        >
          Skip to main content
        </a>
      </body>
    </html>
  );
}