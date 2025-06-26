/** @type {import('next').NextConfig} */
const path = require('path');

// Security headers configuration - different for development and production
const getSecurityHeaders = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const baseHeaders = [
    {
      key: 'X-DNS-Prefetch-Control',
      value: 'on'
    },
    {
      key: 'X-XSS-Protection',
      value: '1; mode=block'
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY'
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff'
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin'
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=()'
    }
  ];

  // Only add HTTPS-enforcing headers in production
  if (!isDevelopment) {
    baseHeaders.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload'
    });
  }

  // CSP with conditional upgrade-insecure-requests
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "media-src 'self' https: blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ];

  // Add connect-src and frame-src with HTTP support in development
  if (isDevelopment) {
    cspDirectives.push("connect-src 'self' http://localhost:* https://accounts.google.com https://www.googleapis.com https://oauth2.googleapis.com https://youtube.googleapis.com");
    cspDirectives.push("frame-src 'self' http://localhost:* https://accounts.google.com");
  } else {
    cspDirectives.push("connect-src 'self' https://accounts.google.com https://www.googleapis.com https://oauth2.googleapis.com https://youtube.googleapis.com");
    cspDirectives.push("frame-src 'self' https://accounts.google.com");
  }

  // Only add upgrade-insecure-requests in production
  if (!isDevelopment) {
    cspDirectives.push("upgrade-insecure-requests");
  }

  baseHeaders.push({
    key: 'Content-Security-Policy',
    value: cspDirectives.join('; ')
  });

  return baseHeaders;
};

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // Remove X-Powered-By header for security
  compress: true, // Enable gzip compression
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: getSecurityHeaders(),
      },
    ];
  },

  webpack: (config, { isServer, dev }) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    
    // Add Supabase functions to ignored modules
    config.ignoreWarnings = [
      { module: /supabase\/functions/ },
    ];

    // Production optimizations
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
          },
        },
      };
    }

    return config;
  },

  // Performance optimizations
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Increase body size limit for file uploads
    },
    scrollRestoration: true, // Enable scroll restoration
  },

  // External packages configuration
  serverExternalPackages: ['sharp'],
  
  // HTTP agent options for better performance
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