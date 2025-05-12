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
  },
  // Add custom configuration here
};

module.exports = nextConfig; 