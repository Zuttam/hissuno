import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mark pino and its dependencies as external to avoid Turbopack bundling issues
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],
};

export default nextConfig;
