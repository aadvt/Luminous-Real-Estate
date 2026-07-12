import type { NextConfig } from "next";

const backendUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://luminous-real-estate-1-2.onrender.com').replace(/\/$/, '')

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/health/:path*',
        destination: `${backendUrl}/health/:path*`,
      },
      {
        source: '/health',
        destination: `${backendUrl}/health`,
      },
      {
        source: '/ws/:path*',
        destination: `${backendUrl}/ws/:path*`,
      },
    ]
  },
};

export default nextConfig;
