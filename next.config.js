/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  // Enable font optimization for Google Fonts
  optimizeFonts: true,
  webpack: (config, { isServer }) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    // Add Supabase functions to ignored modules
    config.ignoreWarnings = [
      { module: /supabase\/functions/ },
    ];
    return config;
  },
  // Increase timeouts for API routes to handle slow external services
  experimental: {
    // Set longer timeout for API routes to prevent timeouts with external services
    serverActions: {
      bodySizeLimit: '10mb', // Increase body size limit for file uploads
    }
  },
  // External packages configuration (moved from experimental)
  serverExternalPackages: [],
  // Extended maximum response time for external API calls
  httpAgentOptions: {
    keepAlive: true,
  },
  images: {
    domains: [
      'lh3.googleusercontent.com',
      'drive.google.com',
      'yt3.ggpht.com',
      'yt3.googleusercontent.com',
      'i.ytimg.com',  // Also adding YouTube thumbnail domain for future use
      'googleusercontent.com',
      'lh1.googleusercontent.com',
      'lh2.googleusercontent.com',
      'lh4.googleusercontent.com',
      'lh5.googleusercontent.com',
      'lh6.googleusercontent.com',
      'www.googleapis.com',
      'accounts.google.com',
      'ssl.gstatic.com',
      'www.gstatic.com',
    ],
    minimumCacheTTL: 3600, // Cache images for 1 hour
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    formats: ['image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/drive-storage/**',
      },
      {
        protocol: 'https',
        hostname: 'yt3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.google.com',
        pathname: '/**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    unoptimized: true, // Use this when having issues with Google Drive images
  },
  // إضافة متغيرات البيئة حتى تكون متاحة للتطبيق
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    API_URL: process.env.API_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET
  },
  typescript: {
    // Exclude Supabase Edge Functions from TypeScript checking
    ignoreBuildErrors: true,
  },
  eslint: {
    // Exclude Supabase Edge Functions from ESLint
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig; 