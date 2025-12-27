import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  crossOrigin: 'anonymous',
  experimental: {
    // Allow large request bodies when Next.js proxies requests (e.g. rewrites to BACK_SERVER_API_URL).
    proxyClientMaxBodySize: '300mb',
  },
  typescript: {
    // This project contains a number of internal/admin pages with loose typing.
    // Allow production builds to proceed even if some pages have TS errors.
    ignoreBuildErrors: true,
  },
  async rewrites() {
    console.log(`BACK_SERVER_API_URL ${process.env.BACK_SERVER_API_URL}`)
    return [
      {
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*',
      },
      // Keep routes-configs API handled by Next.js app routes
      {
        source: '/api/routes-configs/:path*',
        destination: '/api/routes-configs/:path*',
      },
      {
        source: '/api/:path*',
        destination: `${process.env.BACK_SERVER_API_URL}/:path*`,
      },
    ]
  },
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXT_PUBLIC_DOMAIN: process.env.NEXT_PUBLIC_APP_URL,
  },
  devIndicators: false,

  // async headers() {
  //   return [
  //     {
  //       source: '/(.*)',
  //       headers: [
  //         {
  //           key: 'Content-Security-Policy',
  //           value:
  //             "script-src 'self' http://localhost:3000; frame-src 'self' https://qa12.gettr-qa.com; connect-src 'self' ws://localhost:3001 http://localhost:3001 https://qa12.gettr-qa.com",
  //         },
  //       ],
  //     },
  //   ]
  // },
}

export default nextConfig
