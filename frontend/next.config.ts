import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    const backendUrl = process.env.API_INTERNAL_URL;
    if (!backendUrl) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
