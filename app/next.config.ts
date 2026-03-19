import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mark pino and its dependencies as external to avoid Turbopack bundling issues
  serverExternalPackages: [
    'pino',
    'pino-pretty',
    'thread-stream',
    '@react-email/render',
    '@react-email/components',
    'pg',
    'bcryptjs',
  ],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
