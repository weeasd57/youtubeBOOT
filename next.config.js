/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'lh3.googleusercontent.com',
      'drive.google.com',
      'yt3.ggpht.com',
      'i.ytimg.com'  // Also adding YouTube thumbnail domain for future use
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
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Add custom configuration here
  experimental: {
    // Next.js experimental features can go here
  },
};

module.exports = nextConfig; 