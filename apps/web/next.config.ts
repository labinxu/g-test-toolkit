import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  crossOrigin: 'anonymous',
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    console.log(`BACK_SERVER_API_URL ${process.env.BACK_SERVER_API_URL}`);
    return [
      {
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*', // Keep auth routes local
      },
      {
        source: '/api/:path*',
        destination: `http://127.0.0.1:3001/:path*`,
      },
    ];
  },
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXT_PUBLIC_DOMAIN: process.env.NEXT_PUBLIC_APP_URL,
  },
};

export default nextConfig;
