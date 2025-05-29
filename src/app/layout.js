import "./globals.css";
import { Providers } from "./providers";
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/ui/toast';
import { ToastInitializer } from '@/components/ToastHelper';
import FooterWrapper from '@/components/FooterWrapper';
import NavbarWrapper from '@/components/NavbarWrapper';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: "YouTube Drive Uploader",
  description: "A tool to manage YouTube uploads, TikTok downloads, and Drive files",
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
  manifest: '/site.webmanifest'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`scroll-smooth ${inter.variable}`}>
      <body
        className="font-sans antialiased flex flex-col min-h-screen"
        suppressHydrationWarning
      >
        <ToastProvider>
          <ToastInitializer />
          <Providers>
            <NavbarWrapper />
            <main className="flex-grow">
              {children}
            </main>
            <FooterWrapper />
          </Providers>
        </ToastProvider>
      </body>
    </html>
  );
}
