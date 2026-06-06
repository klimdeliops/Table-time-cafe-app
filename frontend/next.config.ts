import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    // Allow any HTTPS image source for dish images stored externally.
    // Tighten this to specific hostnames (e.g. your CDN / S3 bucket) before deploying.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
